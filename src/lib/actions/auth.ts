"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { publicEnv } from "@/lib/config";
import { sendEmail, welcomeEmail, securityAlertEmail } from "@/lib/email";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validation/schemas";
import { ok, fail, fromZodError, type ActionResult } from "./result";
import type { LoginEvent } from "@/types/database";

/** Only ever used to annotate the user's own security history. */
async function requestContext() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || null,
    userAgent: headerList.get("user-agent")?.slice(0, 300) ?? null,
  };
}

async function recordLoginEvent(userId: string, event: LoginEvent["event"], succeeded = true) {
  const supabase = await createClient();
  if (!supabase) return;
  const { ip, userAgent } = await requestContext();
  await supabase
    .from("login_events")
    .insert({ user_id: userId, event, ip_address: ip, user_agent: userAgent, succeeded });
}

/** Keeps an attacker from learning which relative path a redirect will take. */
function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  // Only same-origin absolute paths; reject protocol-relative and external URLs.
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function registerAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    country: formData.get("country"),
    phone: formData.get("phone"),
    acceptTerms: formData.get("acceptTerms") === "on" || formData.get("acceptTerms") === "true",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  if (!supabase) return fail("The platform is not connected to its database yet. See the README for setup.");

  const { firstName, lastName, email, password, country, phone } = parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/dashboard`,
      // Read by the handle_new_user() trigger to populate the profile row.
      data: { first_name: firstName, last_name: lastName, country, phone },
    },
  });

  if (error) {
    // Supabase returns a generic message for existing users when email
    // confirmation is on; surface its message but never a stack or code.
    return fail(error.message || "We could not create that account.");
  }

  if (data.user) {
    await sendEmail(welcomeEmail(email, firstName, publicEnv.appUrl));
  }

  // With email confirmation enabled there is no session yet.
  if (!data.session) {
    return ok(undefined, "Check your inbox to confirm your email address, then sign in.");
  }

  await recordLoginEvent(data.user!.id, "login");
  redirect("/dashboard");
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  if (!supabase) return fail("The platform is not connected to its database yet. See the README for setup.");

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    // Deliberately identical for a wrong password and an unknown address, so
    // the form cannot be used to enumerate registered emails.
    return fail("That email and password combination is not correct.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", data.user.id)
    .maybeSingle<{ account_status: string }>();

  if (profile?.account_status === "suspended" || profile?.account_status === "closed") {
    await supabase.auth.signOut();
    return fail("This account is not active. Please contact support.");
  }

  await Promise.all([
    recordLoginEvent(data.user.id, "login"),
    supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id),
  ]);

  redirect(safeRedirectPath(formData.get("next")?.toString()));
}

export async function logoutAction(): Promise<void> {
  const session = await getSessionContext();
  const supabase = await createClient();
  if (session) await recordLoginEvent(session.user.id, "logout");
  await supabase?.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  if (!supabase) return fail("The platform is not connected to its database yet. See the README for setup.");

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.appUrl}/auth/callback?next=/reset-password`,
  });

  // Always the same response, whether or not the address exists.
  return ok(
    undefined,
    "If an account exists for that address, we have sent a link to reset the password.",
  );
}

export async function resetPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  if (!supabase) return fail("The platform is not connected to its database yet.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("This reset link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message || "We could not update your password.");

  await recordLoginEvent(user.id, "password_reset");
  if (user.email) await sendEmail(securityAlertEmail(user.email, "Password reset", publicEnv.appUrl));

  redirect("/dashboard");
}

export async function changePasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session) return fail("Please sign in again to change your password.");

  // Re-authenticate before accepting a new password, so a hijacked session
  // alone is not enough to lock the owner out.
  const { error: reauthError } = await session.supabase.auth.signInWithPassword({
    email: session.profile.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) {
    return fail("Your current password is not correct.", {
      currentPassword: "That password is not correct",
    });
  }

  const { error } = await session.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message || "We could not update your password.");

  await Promise.all([
    recordLoginEvent(session.user.id, "password_change"),
    sendEmail(securityAlertEmail(session.profile.email, "Password changed", publicEnv.appUrl)),
    session.supabase.from("notifications").insert({
      user_id: session.user.id,
      type: "security_alert",
      title: "Password changed",
      message: "Your account password was changed. If this was not you, contact support immediately.",
      link: "/security",
    }),
  ]);

  revalidatePath("/security");
  return ok(undefined, "Your password has been changed.");
}

/** Signs out every other session for this user. */
export async function signOutOtherSessionsAction(): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return fail("Please sign in again.");

  const { error } = await session.supabase.auth.signOut({ scope: "others" });
  if (error) return fail("We could not sign out your other sessions.");

  await session.supabase.from("notifications").insert({
    user_id: session.user.id,
    type: "security_alert",
    title: "Other sessions signed out",
    message: "All sessions other than this one were signed out.",
    link: "/security",
  });

  revalidatePath("/security");
  return ok(undefined, "All other sessions have been signed out.");
}
