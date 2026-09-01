import "server-only";

import { headers } from "next/headers";
import { publicEnv } from "@/lib/config";

/**
 * The origin the visitor is actually on.
 *
 * Auth emails carry a link back into the application, and that link has to
 * point at the deployment the person is using. A build-time constant cannot do
 * that: Vercel gives every preview deployment its own hostname, so a link built
 * from NEXT_PUBLIC_APP_URL would send a preview user to production — or, if the
 * variable is unset, to http://localhost:3000, which is nobody's deployment but
 * the developer's.
 *
 * Reading the forwarded host is safe for this purpose. The value only ever
 * becomes a redirect target that Supabase itself validates against the
 * project's Redirect URLs allow-list; a spoofed Host header produces a URL
 * Supabase refuses to redirect to. The allow-list is the security control, and
 * it belongs there rather than here.
 *
 * Precedence: the live request, then an explicitly configured canonical origin,
 * then the Vercel-provided deployment URL, then localhost.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();

  // x-forwarded-host is what a proxy (Vercel included) sets; host is the
  // direct value. Take the first entry when a chain of proxies appended more.
  const forwardedHost = headerList.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerList.get("host")?.split(",")[0]?.trim();

  if (host) {
    const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return publicEnv.appUrl;
}
