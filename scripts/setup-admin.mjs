#!/usr/bin/env node
/**
 * Promote an existing account to super_admin.
 *
 * Usage:  npm run setup:admin -- you@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the ambient environment). It never creates an account and never sets a
 * password: register through the sign-up form first, then run this.
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
if (!email) {
  console.error("Usage: npm run setup:admin -- you@example.com");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profile, error } = await supabase
  .from("profiles")
  .select("id, email, role")
  .eq("email", email)
  .maybeSingle();

if (error) {
  console.error("Lookup failed:", error.message);
  process.exit(1);
}
if (!profile) {
  console.error(`No account found for ${email}. Register through the sign-up form first, then rerun.`);
  process.exit(1);
}
if (profile.role === "super_admin") {
  console.log(`${email} is already a super administrator.`);
  process.exit(0);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ role: "super_admin", account_status: "active" })
  .eq("id", profile.id);

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

await supabase.from("audit_logs").insert({
  actor_id: profile.id,
  actor_email: profile.email,
  action: "user.role_changed",
  entity_type: "profile",
  entity_id: profile.id,
  description: `Bootstrap promoted ${profile.email} to super_admin via setup:admin`,
  metadata: { via: "setup_admin_script" },
});

console.log(`${email} is now a super administrator. Sign out and back in to pick up the new role.`);
