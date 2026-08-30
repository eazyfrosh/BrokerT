import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/config";
import { SimulatedMarketDataProvider } from "./simulated";
import type { MarketDataProvider } from "./types";

/**
 * Resolves the configured market-data provider.
 *
 * Today only the simulated demo engine ships. To connect a licensed feed,
 * implement `MarketDataProvider` (see src/lib/market/types.ts), register it in
 * the switch below, and set MARKET_DATA_PROVIDER in the environment. Nothing
 * else in the application needs to change.
 */
export async function getMarketDataProvider(
  readClient?: SupabaseClient | null,
): Promise<MarketDataProvider | null> {
  const client = readClient ?? (await createClient());
  if (!client) return null;

  const { marketDataProvider } = serverEnv();

  switch (marketDataProvider) {
    case "simulated":
    default:
      // The service-role client lets the demo engine persist ticks; without it
      // the provider still serves the last stored quote, read-only.
      return new SimulatedMarketDataProvider(client, createServiceRoleClient());
  }
}
