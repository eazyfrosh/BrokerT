"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { supportTicketSchema, supportReplySchema, contactSchema } from "@/lib/validation/schemas";
import { generateReference } from "@/lib/utils";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";

export async function createSupportTicketAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string; reference: string }>> {
  const parsed = supportTicketSchema.safeParse({
    subject: formData.get("subject"),
    category: formData.get("category") ?? "General",
    priority: formData.get("priority") ?? "normal",
    message: formData.get("message"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to contact support.");

  const reference = generateReference("TKT");

  const { data: ticket, error } = await session.supabase
    .from("support_tickets")
    .insert({
      reference,
      user_id: session.user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: "open",
    })
    .select("id, reference")
    .single<{ id: string; reference: string }>();

  if (error || !ticket) return fromDatabaseError(error, "We could not open that ticket.");

  const { error: messageError } = await session.supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: session.user.id,
    is_staff: false,
    body: parsed.data.message,
  });

  if (messageError) return fail("Your ticket was created but the message could not be saved.");

  revalidatePath("/support");
  return ok(ticket, `Ticket ${ticket.reference} opened.`);
}

export async function replyToTicketAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = supportReplySchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  // RLS only accepts a non-staff message on a ticket the caller owns.
  const { error } = await session.supabase.from("support_messages").insert({
    ticket_id: parsed.data.ticketId,
    author_id: session.user.id,
    is_staff: false,
    body: parsed.data.body,
  });

  if (error) return fromDatabaseError(error, "We could not post that reply.");

  revalidatePath(`/support/${parsed.data.ticketId}`);
  revalidatePath("/support");
  return ok(undefined, "Reply sent.");
}

/**
 * Public contact form. Signed-in visitors get a real ticket; signed-out ones
 * are told to use email rather than having a record silently dropped.
 */
export async function contactAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) {
    return fail(
      "Please sign in to open a support ticket, or email support directly — we cannot record messages from signed-out visitors.",
    );
  }

  const reference = generateReference("TKT");

  const { data: ticket, error } = await session.supabase
    .from("support_tickets")
    .insert({
      reference,
      user_id: session.user.id,
      subject: parsed.data.subject,
      category: "Contact",
      priority: "normal",
      status: "open",
    })
    .select("id, reference")
    .single<{ id: string; reference: string }>();

  if (error || !ticket) return fromDatabaseError(error, "We could not send that message.");

  await session.supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: session.user.id,
    is_staff: false,
    body: parsed.data.message,
  });

  revalidatePath("/support");
  return ok(undefined, `Message received. We opened ticket ${ticket.reference} for you.`);
}
