import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the one-time code from a confirmation or password-reset email for
 * a session cookie, then forwards the visitor on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Only same-origin relative paths may be used as a redirect target.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("That link is invalid or has already been used.")}`,
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("That link has expired. Please request a new one.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
