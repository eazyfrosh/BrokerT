"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext, isAdminRole } from "@/lib/auth";
import {
  adminUserStatusSchema,
  adminUserRoleSchema,
  adminOrderStatusSchema,
  adminCarOrderSchema,
  adminNotificationSchema,
  adminInvestmentSchema,
  adminKycSchema,
  supportReplySchema,
  uuidSchema,
} from "@/lib/validation/schemas";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";

/** Every admin action re-checks the caller's role server-side. */
async function requireAdminSession() {
  const session = await getSessionContext();
  if (!session) return null;
  if (!isAdminRole(session.profile.role)) return null;
  return session;
}

export async function adminUpdateUserStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = adminUserStatusSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  // The RPC audits the change and notifies the customer in the same transaction.
  const { error } = await session.supabase.rpc("admin_update_user_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });

  if (error) return fromDatabaseError(error, "We could not update that account.");

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return ok(undefined, "Account status updated.");
}

export async function adminUpdateUserRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = adminUserRoleSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");
  // Minting administrators is restricted to super admins by the RPC as well.
  if (session.profile.role !== "super_admin") {
    return fail("Only a super administrator can change roles.");
  }

  const { error } = await session.supabase.rpc("admin_update_user_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) return fromDatabaseError(error, "We could not update that role.");

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return ok(undefined, "Role updated.");
}

export async function adminUpdateKycAction(input: unknown): Promise<ActionResult> {
  const parsed = adminKycSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { error } = await session.supabase
    .from("profiles")
    .update({ kyc_status: parsed.data.status })
    .eq("id", parsed.data.userId);

  if (error) return fromDatabaseError(error, "We could not update that verification status.");

  await session.supabase.rpc("admin_log", {
    p_action: "user.kyc_changed",
    p_entity_type: "profile",
    p_entity_id: parsed.data.userId,
    p_description: `Admin set verification status to ${parsed.data.status}`,
    p_metadata: { status: parsed.data.status, note: parsed.data.note || null },
  });

  await session.supabase.from("notifications").insert({
    user_id: parsed.data.userId,
    type: "system",
    title: "Verification status updated",
    message: `Your identity verification status is now "${parsed.data.status.replace(/_/g, " ")}".${
      parsed.data.note ? ` ${parsed.data.note}` : ""
    }`,
    link: "/profile",
    created_by: session.user.id,
  });

  revalidatePath("/admin/kyc");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return ok(undefined, "Verification status updated.");
}

export async function adminUpdateOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = adminOrderStatusSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { error } = await session.supabase.rpc("admin_update_order_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });

  if (error) return fromDatabaseError(error, "We could not update that order.");

  revalidatePath("/admin/orders");
  return ok(undefined, "Order updated.");
}

export async function adminUpdateCarOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = adminCarOrderSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { error } = await session.supabase.rpc("admin_update_car_order", {
    p_car_order_id: parsed.data.carOrderId,
    p_status: parsed.data.status ?? null,
    p_estimated_delivery: parsed.data.estimatedDelivery || null,
    p_internal_notes: parsed.data.internalNotes || null,
  });

  if (error) return fromDatabaseError(error, "We could not update that order request.");

  revalidatePath("/admin/car-orders");
  return ok(undefined, "Vehicle order updated.");
}

export async function adminBroadcastNotificationAction(input: unknown): Promise<ActionResult<number>> {
  const parsed = adminNotificationSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  if (parsed.data.target === "selected" && !parsed.data.userIds?.length) {
    return fail("Select at least one recipient.");
  }

  const { data, error } = await session.supabase.rpc("admin_broadcast_notification", {
    p_title: parsed.data.title,
    p_message: parsed.data.message,
    p_type: parsed.data.type,
    p_link: parsed.data.link || null,
    p_user_ids: parsed.data.target === "selected" ? parsed.data.userIds : null,
  });

  if (error) return fromDatabaseError(error, "We could not send that notification.");

  revalidatePath("/admin/notifications");
  const count = (data as number) ?? 0;
  return ok(count, `Sent to ${count} ${count === 1 ? "recipient" : "recipients"}.`);
}

export async function adminSaveInvestmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = adminInvestmentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const payload = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    category: parsed.data.category,
    summary: parsed.data.summary,
    description: parsed.data.description || null,
    objective: parsed.data.objective || null,
    risk_level: parsed.data.riskLevel,
    risk_disclosure: parsed.data.riskDisclosure,
    terms: parsed.data.terms || null,
    target_return_pct: parsed.data.targetReturnPct,
    duration_months: parsed.data.durationMonths,
    minimum_amount: parsed.data.minimumAmount,
    maximum_amount: parsed.data.maximumAmount ?? null,
    management_fee_pct: parsed.data.managementFeePct,
    performance_fee_pct: parsed.data.performanceFeePct,
    capacity_amount: parsed.data.capacityAmount ?? null,
    status: parsed.data.status,
    image_url: parsed.data.imageUrl || null,
  };

  if (parsed.data.id) {
    const { error } = await session.supabase
      .from("investments")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) {
      if (error.code === "23505") return fail("Another strategy already uses that slug.");
      return fromDatabaseError(error, "We could not save that strategy.");
    }

    await session.supabase.rpc("admin_log", {
      p_action: "investment.updated",
      p_entity_type: "investment",
      p_entity_id: parsed.data.id,
      p_description: `Admin updated strategy "${parsed.data.name}" (status: ${parsed.data.status})`,
      p_metadata: { status: parsed.data.status },
    });

    revalidatePath("/admin/investments");
    revalidatePath("/investments");
    return ok({ id: parsed.data.id }, "Strategy saved.");
  }

  const { data, error } = await session.supabase
    .from("investments")
    .insert({ ...payload, created_by: session.user.id, is_simulated: true })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    if (error?.code === "23505") return fail("Another strategy already uses that slug.");
    return fromDatabaseError(error, "We could not create that strategy.");
  }

  await session.supabase.rpc("admin_log", {
    p_action: "investment.created",
    p_entity_type: "investment",
    p_entity_id: data.id,
    p_description: `Admin created strategy "${parsed.data.name}"`,
    p_metadata: { status: parsed.data.status },
  });

  revalidatePath("/admin/investments");
  revalidatePath("/investments");
  return ok(data, "Strategy created.");
}

export async function adminSetInvestmentStatusAction(
  investmentId: string,
  status: "draft" | "open" | "paused" | "closed" | "archived",
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(investmentId);
  if (!parsed.success) return fail("That strategy could not be found.");

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { data, error } = await session.supabase
    .from("investments")
    .update({ status })
    .eq("id", parsed.data)
    .select("name")
    .maybeSingle<{ name: string }>();

  if (error || !data) return fromDatabaseError(error, "We could not update that strategy.");

  await session.supabase.rpc("admin_log", {
    p_action: "investment.status_changed",
    p_entity_type: "investment",
    p_entity_id: parsed.data,
    p_description: `Admin changed investment status of "${data.name}" to ${status}`,
    p_metadata: { status },
  });

  revalidatePath("/admin/investments");
  revalidatePath("/investments");
  return ok(undefined, `Strategy ${status}.`);
}

export async function adminReplyToTicketAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = supportReplySchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { error } = await session.supabase.from("support_messages").insert({
    ticket_id: parsed.data.ticketId,
    author_id: session.user.id,
    is_staff: true,
    body: parsed.data.body,
  });

  if (error) return fromDatabaseError(error, "We could not post that reply.");

  await session.supabase
    .from("support_tickets")
    .update({ status: "pending" })
    .eq("id", parsed.data.ticketId);

  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  revalidatePath("/admin/support");
  return ok(undefined, "Reply sent.");
}

export async function adminSetTicketStatusAction(
  ticketId: string,
  status: "open" | "pending" | "resolved" | "closed",
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(ticketId);
  if (!parsed.success) return fail("That ticket could not be found.");

  const session = await requireAdminSession();
  if (!session) return fail("You do not have permission to do that.");

  const { error } = await session.supabase
    .from("support_tickets")
    .update({ status })
    .eq("id", parsed.data);

  if (error) return fromDatabaseError(error, "We could not update that ticket.");

  await session.supabase.rpc("admin_log", {
    p_action: "support.status_changed",
    p_entity_type: "support_ticket",
    p_entity_id: parsed.data,
    p_description: `Admin set ticket status to ${status}`,
    p_metadata: { status },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${parsed.data}`);
  return ok(undefined, "Ticket updated.");
}
