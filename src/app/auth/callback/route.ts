import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Turns the link in a Supabase auth email into a session cookie.
 *
 * Supabase can deliver that link in more than one shape, depending on the
 * project's email templates and flow configuration, so this route accepts all
 * of them rather than assuming one:
 *
 *   ?code=…                      PKCE / OAuth. Exchanged for a session.
 *   ?token_hash=…&type=signup    The OTP verify flow, which the default email
 *                                templates produce. Verified, not exchanged.
 *   ?error=…&error_description=… Supabase rejected the link itself — expired,
 *                                already consumed, or the wrong project.
 *   #access_token=…              The implicit flow puts the token in the URL
 *                                fragment, which never reaches the server.
 *
 * Anything unrecognised is reported as unrecognised rather than as "already
 * used", so the message points at the real problem.
 */

/** Only same-origin relative paths may be used as a redirect target. */
function safeNext(value: string | null, fallback = "/dashboard"): string {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function backToLogin(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent(message)}`);
}

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // A password-reset link must land on the page that sets a new password,
  // whatever the caller asked for.
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"));

  // 1. Supabase rejected the link before it ever reached us.
  if (error) {
    const detail = errorDescription?.replace(/\+/g, " ");
    return backToLogin(
      origin,
      detail
        ? `${detail}. Request a new link and open it in the same browser.`
        : "That link is no longer valid. Request a new one.",
    );
  }

  const isOtpLink = Boolean(tokenHash && type && OTP_TYPES.has(type as EmailOtpType));

  // 2. Nothing usable in the query string. Decided before touching the database,
  //    because there is nothing to verify. The implicit flow keeps its token in
  //    the URL fragment, which the browser never sends to the server — so say
  //    that plainly rather than blaming the link.
  if (!code && !isOtpLink) {
    return backToLogin(
      origin,
      "That link did not carry a sign-in token. If you have already confirmed your email, just sign in below.",
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return backToLogin(origin, "The platform is not connected to its database yet.");
  }

  // 3. PKCE: exchange the one-time code for a session.
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return backToLogin(
        origin,
        "That link could not be completed. It may have expired, or been opened in a different browser from the one that requested it.",
      );
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 4. OTP verify: what the default email templates produce.
  if (isOtpLink && tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (verifyError) {
      return backToLogin(origin, "That link has expired or has already been used. Request a new one.");
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Unreachable: the guard above admits only the two handled shapes.
  return backToLogin(origin, "That link could not be completed. Request a new one.");
}
