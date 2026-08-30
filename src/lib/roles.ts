import type { Profile, UserRole } from "@/types/database";

/**
 * Pure role helpers.
 *
 * Kept out of `src/lib/auth.ts` so they can be imported anywhere — client
 * components and unit tests included — without pulling in `server-only`.
 * They describe roles; they never grant anything. Authorisation is enforced by
 * Row Level Security and by the SECURITY DEFINER functions in the database.
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === "super_admin";
}

export function displayName(profile: Pick<Profile, "first_name" | "last_name" | "email">): string {
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return full || profile.email.split("@")[0];
}
