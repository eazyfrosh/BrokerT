import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types/database";

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AppNotification[]>();
  return data ?? [];
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
