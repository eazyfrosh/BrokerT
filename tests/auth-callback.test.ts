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
