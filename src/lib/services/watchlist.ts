import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Asset, Watchlist, WatchlistItem } from "@/types/database";

export interface WatchlistEntry extends WatchlistItem {
  assets:
    | (Pick<Asset, "id" | "symbol" | "name" | "exchange" | "sector"> & {
        market_quotes: { price: number; previous_close: number; day_high: number; day_low: number } | null;
      })
    | null;
}

export async function getMyWatchlist(): Promise<{ watchlist: Watchlist | null; items: WatchlistEntry[] }> {
  const supabase = await createClient();
  if (!supabase) return { watchlist: null, items: [] };

  const { data: watchlist } = await supabase
    .from("watchlists")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Watchlist>();

  if (!watchlist) return { watchlist: null, items: [] };

  const { data: items } = await supabase
    .from("watchlist_items")
    .select(
      "*, assets(id, symbol, name, exchange, sector, market_quotes(price, previous_close, day_high, day_low))",
    )
    .eq("watchlist_id", watchlist.id)
    .order("created_at", { ascending: true })
    .returns<WatchlistEntry[]>();

  return { watchlist, items: items ?? [] };
}

/** Instruments not already on the caller's watchlist. */
export async function listAvailableAssets(excludeIds: string[]): Promise<Asset[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase.from("assets").select("*").order("symbol", { ascending: true });
  if (excludeIds.length) query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data } = await query.returns<Asset[]>();
  return data ?? [];
}
