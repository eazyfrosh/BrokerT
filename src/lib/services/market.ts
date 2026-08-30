import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMarketDataProvider } from "@/lib/market/provider";
import { getMarketStatus } from "@/lib/market/session";
import { PRIMARY_SYMBOL } from "@/lib/config";
import type { MarketSeries, Quote, Timeframe } from "@/lib/market/types";
import type { Asset } from "@/types/database";

/** The tradable instrument record, cached per request. */
export const getPrimaryAsset = cache(async (): Promise<Asset | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("symbol", PRIMARY_SYMBOL)
    .maybeSingle<Asset>();
  return data ?? null;
});

export const getAssetBySymbol = cache(async (symbol: string): Promise<Asset | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("assets").select("*").eq("symbol", symbol).maybeSingle<Asset>();
  return data ?? null;
});

/**
 * Current quote for a symbol. Advancing the demo tick is a side effect of the
 * provider, so this is intentionally not cached across requests.
 */
export async function getQuote(symbol: string = PRIMARY_SYMBOL): Promise<Quote | null> {
  const provider = await getMarketDataProvider();
  if (!provider) return null;
  return provider.getQuote(symbol);
}

export async function getSeries(
  symbol: string = PRIMARY_SYMBOL,
  timeframe: Timeframe = "1M",
): Promise<MarketSeries | null> {
  const provider = await getMarketDataProvider();
  if (!provider) return null;
  return provider.getSeries(symbol, timeframe);
}

export function marketStatus() {
  return getMarketStatus();
}

/** Everything the market pages need, in one round of work. */
export async function getMarketOverview(timeframe: Timeframe = "1M") {
  const [asset, quote, series] = await Promise.all([
    getPrimaryAsset(),
    getQuote(),
    getSeries(PRIMARY_SYMBOL, timeframe),
  ]);
  return { asset, quote, series, status: getMarketStatus() };
}
