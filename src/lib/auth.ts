import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import type { Profile } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export interface SessionContext {
  supabase: SupabaseClient;
  user: User;
  /**
   * Null only when the session is valid but the account could not be
   * provisioned — an incomplete database. Callers must route that to an
   * explanation, never back to sign-in.
   */
  profile: Profile | null;
}

/** A session whose profile is present. What every product page requires. */
export interface ReadySessionContext extends SessionContext {
  profile: Profile;
}

/**
 * Reads the verified user and their profile once per request.
 * `cache` dedupes the round trip across every component in the tree.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (profile) return { supabase, user, profile };

  // A valid session with no profile row means provisioning did not run — the
  // schema was applied partially, or the account predates the trigger. Repair
  // it rather than reporting the person as signed out, which sent them to
  // /login, where the proxy saw a valid session and sent them straight back.
  const { data: repaired, error } = await supabase.rpc("ensure_profile");
  if (error || !repaired) {
    console.error("[auth] could not provision a profile:", error?.message ?? "no row returned");
    return { supabase, user, profile: null };
  }

  return { supabase, user, profile: repaired as unknown as Profile };
});

/** Redirects to sign-in when there is no session. */
export async function requireSession(nextPath?: string): Promise<ReadySessionContext> {
  const session = await getSessionContext();
  if (!session) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }

  // Signed in, but the account could not be provisioned. Sending them to
  // /login would bounce off the proxy and loop, so explain it instead.
  if (!session.profile) {
    redirect("/account-setup-required");
  }

  if (session.profile.account_status === "suspended" || session.profile.account_status === "closed") {
    redirect("/account-suspended");
  }

  return session as ReadySessionContext;
}

/** Redirects non-admins away from the admin area. */
export async function requireAdmin(): Promise<ReadySessionContext> {
  const session = await requireSession("/admin");
  if (!isAdminRole(session.profile.role)) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<ReadySessionContext> {
  const session = await requireAdmin();
  if (session.profile.role !== "super_admin") {
    redirect("/admin");
  }
  return session;
}

// Re-exported so server code can keep importing both from one place.
export { isAdminRole, isSuperAdminRole, displayName } from "@/lib/roles";
