"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, isSupabaseConfigured } from "@/lib/config";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client. Returns `null` when the project has not been
 * configured yet, so client components can degrade gracefully instead of
 * throwing during render.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;
  try {
    cached = createBrowserClient(publicEnv.supabaseUrl!, publicEnv.supabaseAnonKey!);
  } catch (error) {
    console.error("[supabase] could not create the browser client:", (error as Error).message);
    return null;
  }
  return cached;
}

/** Throwing variant for code paths that already required configuration. */
export function requireSupabaseBrowserClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return client;
}
