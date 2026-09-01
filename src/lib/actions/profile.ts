"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { profileSchema, settingsSchema } from "@/lib/validation/schemas";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";

export async function updateProfileAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    country: formData.get("country"),
    avatarUrl: formData.get("avatarUrl") ?? "",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  // Role, status and verification are deliberately absent: a database trigger
  // rejects any attempt to change them from a non-admin session.
  const { error } = await session.supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone || null,
      country: parsed.data.country,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", session.user.id);

  if (error) return fromDatabaseError(error, "We could not save your profile.");

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return ok(undefined, "Your profile has been saved.");
}

export async function updateSettingsAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse({
    theme: formData.get("theme"),
    emailOrderUpdates: formData.get("emailOrderUpdates") === "on",
    emailInvestmentUpdates: formData.get("emailInvestmentUpdates") === "on",
    emailSecurityAlerts: formData.get("emailSecurityAlerts") === "on",
    emailMarketing: formData.get("emailMarketing") === "on",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  const payload = {
    user_id: session.user.id,
    theme: parsed.data.theme,
    email_order_updates: parsed.data.emailOrderUpdates,
    email_investment_updates: parsed.data.emailInvestmentUpdates,
    email_security_alerts: parsed.data.emailSecurityAlerts,
    email_marketing: parsed.data.emailMarketing,
  };

  const { error } = await session.supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return fromDatabaseError(error, "We could not save your preferences.");

  revalidatePath("/settings");
  return ok(undefined, "Your preferences have been saved.");
}
