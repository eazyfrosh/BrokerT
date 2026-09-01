import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The auth callback is the single point where an emailed link becomes a
 * session. It originally handled only `?code=`, so every link produced by
 * Supabase's default email templates — which use `token_hash` + `type` — was
 * reported to the customer as "invalid or already used".
 *
 * The route is exercised for real over HTTP during verification; these checks
 * guard against a branch being dropped again.
 */
const SOURCE = readFileSync("src/app/auth/callback/route.ts", "utf8");

describe("auth callback", () => {
  it("handles the PKCE code exchange", () => {
    expect(SOURCE).toContain('searchParams.get("code")');
    expect(SOURCE).toContain("exchangeCodeForSession");
  });

  it("handles the OTP verify links the default email templates produce", () => {
    expect(SOURCE).toContain('searchParams.get("token_hash")');
    expect(SOURCE).toContain("verifyOtp");
  });

  it("accepts every email OTP type Supabase can send", () => {
    for (const type of ["signup", "invite", "magiclink", "recovery", "email_change", "email"]) {
      expect(SOURCE).toContain(`"${type}"`);
    }
  });

  it("relays Supabase's own rejection instead of inventing a reason", () => {
    expect(SOURCE).toContain('searchParams.get("error")');
    expect(SOURCE).toContain('searchParams.get("error_description")');
  });

  it("sends a password-reset link to the page that sets a new password", () => {
    expect(SOURCE).toContain('type === "recovery" ? "/reset-password"');
  });

  it("reports a link carrying no token as such, rather than as already used", () => {
    expect(SOURCE).toContain("did not carry a sign-in token");
  });

  it("only ever redirects to a same-origin relative path", () => {
    expect(SOURCE).toContain('value.startsWith("/") && !value.startsWith("//")');
  });
});

/**
 * Auth emails must link back to the deployment the visitor is actually using.
 * A build-time constant cannot do that when every preview deployment has its
 * own hostname.
 */
describe("email link origin", () => {
  const ORIGIN = readFileSync("src/lib/request-origin.ts", "utf8");
  const AUTH_ACTIONS = readFileSync("src/lib/actions/auth.ts", "utf8");

  it("derives the origin from the live request", () => {
    expect(ORIGIN).toContain('headerList.get("x-forwarded-host")');
    expect(ORIGIN).toContain('headerList.get("x-forwarded-proto")');
  });

  it("falls back to the configured origin, then Vercel's, then localhost", () => {
    expect(ORIGIN).toContain("process.env.NEXT_PUBLIC_APP_URL");
    expect(ORIGIN).toContain("process.env.VERCEL_URL");
  });

  it("assumes http only for a local host, https otherwise", () => {
    // Written without the dotAll flag, which needs an ES2018 target.
    expect(ORIGIN).toContain('host.startsWith("localhost")');
    expect(ORIGIN).toContain('host.startsWith("127.0.0.1")');
    expect(ORIGIN).toContain('? "http"');
    expect(ORIGIN).toContain(': "https"');
  });

  it("no longer builds auth redirects from a build-time constant", () => {
    expect(AUTH_ACTIONS).not.toContain("publicEnv.appUrl");
    expect(AUTH_ACTIONS).toContain("emailRedirectTo: `${origin}/auth/callback");
    expect(AUTH_ACTIONS).toContain("redirectTo: `${await getRequestOrigin()}/auth/callback");
  });

  it("uses it for transactional emails too", () => {
    for (const file of ["orders", "cars", "investments"]) {
      const source = readFileSync(`src/lib/actions/${file}.ts`, "utf8");
      expect(source, `${file}.ts still links emails to a fixed origin`).not.toContain(
        "publicEnv.appUrl",
      );
    }
  });
});

/**
 * A configuration mistake must never surface as a generic failure on every
 * route. The Supabase client throws on a URL without a scheme — an easy paste
 * error — and that exception previously reached the error boundary.
 */
describe("configuration resilience", () => {
  const CONFIG = readFileSync("src/lib/config.ts", "utf8");
  const SERVER = readFileSync("src/lib/supabase/server.ts", "utf8");
  const BROWSER = readFileSync("src/lib/supabase/client.ts", "utf8");
  const HEALTH = readFileSync("src/app/api/health/route.ts", "utf8");

  it("rejects a supabase URL that is not absolute http(s)", () => {
    expect(CONFIG).toContain("function readUrl");
    expect(CONFIG).toContain('parsed.protocol !== "http:" && parsed.protocol !== "https:"');
  });

  it("can tell a malformed URL apart from a missing one", () => {
    expect(CONFIG).toContain("export function supabaseUrlIsMalformed");
  });

  it("never lets client construction escape as an exception", () => {
    for (const [name, source] of [
      ["server", SERVER],
      ["browser", BROWSER],
    ] as const) {
      expect(source, `${name} client must catch a constructor throw`).toMatch(/catch\s*\(error\)/);
    }
  });

  it("reports configuration state without exposing any secret", () => {
    expect(HEALTH).toContain("supabaseAnonKey: publicEnv.supabaseAnonKey ? \"ok\" : \"missing\"");
    // Only the host is ever echoed back, never a key or a full URL with auth.
    expect(HEALTH).toContain("new URL(publicEnv.supabaseUrl).host");
    expect(HEALTH).not.toMatch(/serviceRoleKey:\s*env\.supabaseServiceRoleKey\b(?!\s*\?)/);
  });

  it("names the tables that are unreachable when migrations are missing", () => {
    expect(HEALTH).toContain("run supabase/setup.sql");
    expect(HEALTH).toContain("unreachableTables");
  });
});

/**
 * A valid session with no profile row used to produce an endless redirect:
 * requireSession sent the person to /login, and the proxy — seeing a valid
 * session on an auth route — sent them straight back.
 */
describe("missing profile recovery", () => {
  const AUTH = readFileSync("src/lib/auth.ts", "utf8");
  const PROXY = readFileSync("src/proxy.ts", "utf8");
  const ENSURE = readFileSync("supabase/migrations/0008_ensure_profile.sql", "utf8");

  it("attempts to provision the profile before giving up", () => {
    expect(AUTH).toContain('supabase.rpc("ensure_profile")');
  });

  it("routes an unprovisionable session to an explanation, never to sign-in", () => {
    expect(AUTH).toContain('redirect("/account-setup-required")');
    // The old behaviour: returning null here, which requireSession read as
    // "signed out" and bounced to /login.
    expect(AUTH).not.toMatch(/if \(!profile\) return null;/);
  });

  it("keeps that page clear of both redirect sets, so nothing bounces off it", () => {
    const protectedList = PROXY.slice(PROXY.indexOf("PROTECTED_PREFIXES"), PROXY.indexOf("AUTH_ROUTES"));
    const authList = PROXY.slice(PROXY.indexOf("AUTH_ROUTES"), PROXY.indexOf("function matchesPrefix"));
    expect(protectedList).not.toContain("account-setup-required");
    expect(authList).not.toContain("account-setup-required");
  });

  it("provisions everything the trigger would, idempotently", () => {
    for (const table of ["profiles", "user_settings", "wallets", "portfolios", "watchlists"]) {
      expect(ENSURE).toContain(`into public.${table}`);
    }
    expect(ENSURE).toContain("on conflict");
  });

  it("acts only on the caller's own account", () => {
    expect(ENSURE).toContain("v_user_id uuid := auth.uid()");
    expect(ENSURE).toContain("AUTH_REQUIRED");
    expect(ENSURE).toContain("revoke all on function public.ensure_profile() from public");
  });
});
