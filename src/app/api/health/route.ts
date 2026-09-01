import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv, serverEnv, supabaseUrlIsMalformed, DEMO_MODE } from "@/lib/config";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Configuration and connectivity check.
 *
 * Reports whether each piece of setup is in place and whether the database
 * actually answers — enough to diagnose a deployment without reading the logs,
 * and without revealing anything sensitive. It returns booleans, the public
 * project host, and the names of any missing tables; never a key, never a
 * key fragment, never a row of customer data.
 */
export async function GET() {
  const env = serverEnv();

  const checks: Record<string, unknown> = {
    supabaseUrl: publicEnv.supabaseUrl
      ? "ok"
      : supabaseUrlIsMalformed()
        ? "malformed — must start with https://"
        : "missing",
    supabaseAnonKey: publicEnv.supabaseAnonKey ? "ok" : "missing",
    supabaseServiceRoleKey: env.supabaseServiceRoleKey ? "ok" : "missing",
    demoMode: DEMO_MODE,
    marketDataProvider: env.marketDataProvider,
    emailProvider: env.resendApiKey ? "resend" : "none (logged only)",
    requestOrigin: await getRequestOrigin(),
  };

  // Only the host, so the response identifies the project without exposing a
  // full connection string.
  if (publicEnv.supabaseUrl) {
    try {
      checks.supabaseHost = new URL(publicEnv.supabaseUrl).host;
    } catch {
      checks.supabaseHost = "unparseable";
    }
  }

  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, status: "Supabase is not configured", checks },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Probe the tables the application cannot start without. A missing table
  // means the migrations have not been applied.
  const required = ["profiles", "assets", "market_quotes", "investments", "vehicles"] as const;
  const missing: string[] = [];
  let firstError: string | null = null;

  for (const table of required) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      missing.push(table);
      firstError ??= error.message;
    }
  }

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        status: "Database not ready — run supabase/setup.sql in the SQL editor",
        unreachableTables: missing,
        detail: firstError,
        checks,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: quote } = await supabase
    .from("market_quotes")
    .select("price, quoted_at")
    .limit(1)
    .maybeSingle<{ price: number; quoted_at: string }>();

  return NextResponse.json(
    {
      ok: true,
      status: "Ready",
      seeded: Boolean(quote),
      lastQuoteAt: quote?.quoted_at ?? null,
      checks,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
