import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, isSupabaseConfigured, serverEnv } from "@/lib/config";

/**
 * Request-scoped Supabase client bound to the caller's session cookies.
 * Every query made through it is subject to Row Level Security.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  // A bad URL or key makes the client constructor throw. Degrading to the
  // "not configured" path shows the operator a setup notice instead of a
  // generic failure on every route.
  try {
    return createServerClient(publicEnv.supabaseUrl!, publicEnv.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: the proxy refreshes the session
          // cookie instead, so this is safe to ignore.
        }
      },
    },
    });
  } catch (error) {
    console.error("[supabase] could not create the server client:", (error as Error).message);
    return null;
  }
}

export async function requireClient(): Promise<SupabaseClient> {
  const client = await createClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return client;
}

/**
 * Service-role client. Bypasses RLS entirely — never expose it to the browser
 * and never construct it from a Client Component. Used only by trusted server
 * routines (admin setup, seeding, the market engine).
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const env = serverEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;

  try {
    return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (error) {
    console.error("[supabase] could not create the service-role client:", (error as Error).message);
    return null;
  }
}
