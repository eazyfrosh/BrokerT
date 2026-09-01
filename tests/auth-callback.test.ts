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
    expect(ORIGIN).toMatch(/localhost.*127\.0\.0\.1.*"http".*"https"/s);
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
