import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/investments/active",
  "/trade",
  "/orders",
  "/watchlist",
  "/wallet",
  "/deposits",
  "/withdrawals",
  "/transactions",
  "/notifications",
  "/profile",
  "/settings",
  "/security",
  "/support",
  "/car-orders",
  "/cars/checkout",
  "/admin",
];

/** Auth screens that a signed-in user should never see. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin authorisation itself is enforced in the layout (which can read the
  // profile role) and again by RLS — the proxy only gates authentication.
  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
