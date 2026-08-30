import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/config";
import { emailSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: emailSchema,
  secret: z.string().min(16, "Secret is too short"),
});

/** Length-independent constant-time comparison. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still compare, so the response time does not reveal the length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * One-time administrator bootstrap.
 *
 * Promotes an existing, already-registered account to super_admin. It never
 * creates an account and never sets a password: the person signs up through the
 * normal flow first, then this endpoint elevates their role.
 *
 * Requires ADMIN_SETUP_SECRET to be set in the environment; without it the
 * endpoint is disabled entirely. Remove or rotate the secret once the first
 * administrator exists.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (!env.adminSetupSecret) {
    return NextResponse.json(
      { error: "Admin setup is disabled. Set ADMIN_SETUP_SECRET to enable it." },
      { status: 404 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!secretsMatch(parsed.data.secret, env.adminSetupSecret)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  // When ADMIN_EMAIL is set, only that address may be promoted.
  if (env.adminEmail && env.adminEmail.toLowerCase() !== parsed.data.email) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("email", parsed.data.email)
    .maybeSingle<{ id: string; email: string; role: string }>();

  if (error) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "No account with that email. Register through the sign-up form first, then retry." },
      { status: 404 },
    );
  }
  if (profile.role === "super_admin") {
    return NextResponse.json({ ok: true, message: "That account is already a super administrator." });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: "super_admin", account_status: "active" })
    .eq("id", profile.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not update that account." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    action: "user.role_changed",
    entity_type: "profile",
    entity_id: profile.id,
    description: `Bootstrap promoted ${profile.email} to super_admin via the admin setup endpoint`,
    metadata: { via: "admin_setup_endpoint" },
  });

  return NextResponse.json({
    ok: true,
    message: `${profile.email} is now a super administrator. Rotate or remove ADMIN_SETUP_SECRET now.`,
  });
}
