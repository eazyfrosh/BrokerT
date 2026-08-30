import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export interface SessionContext {
  supabase: SupabaseClient;
  user: User;
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

  if (!profile) return null;

  return { supabase, user, profile };
});

/** Redirects to sign-in when there is no session. */
export async function requireSession(nextPath?: string): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  if (session.profile.account_status === "suspended" || session.profile.account_status === "closed") {
    redirect("/account-suspended");
  }
  return session;
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/** Redirects non-admins away from the admin area. */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession("/admin");
  if (!isAdminRole(session.profile.role)) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await requireAdmin();
  if (session.profile.role !== "super_admin") {
    redirect("/admin");
  }
  return session;
}

export function displayName(profile: Pick<Profile, "first_name" | "last_name" | "email">): string {
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return full || profile.email.split("@")[0];
}
