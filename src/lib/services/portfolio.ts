import "server-only";

import { createClient } from "@/lib/supabase/server";
import { summarisePortfolio, buildAllocation, type HoldingInput, type PortfolioSummary, type AllocationSlice } from "@/lib/calculations/portfolio";
import { getQuote } from "./market";
import { PRIMARY_SYMBOL } from "@/lib/config";
import type { PortfolioSnapshot, Wallet } from "@/types/database";

interface HoldingRow {
  id: string;
  asset_id: string;
  quantity: number;
  average_cost: number;
  realized_pnl: number;
  // The quote is reached through the asset: market_quotes.asset_id is the
  // only foreign key that links the two, and it is unique per asset.
  assets: {
    symbol: string;
    name: string;
    currency: string;
    market_quotes: { price: number; previous_close: number } | null;
  } | null;
}

export interface PortfolioView extends PortfolioSummary {
  allocation: AllocationSlice[];
  wallet: Wallet | null;
}

/**
 * Builds the account view from live data.
 *
 * Reading the primary quote first lets the demo market engine advance the
 * stored price, so holdings are valued at the same tick the rest of the page
 * shows rather than a stale one.
 */
export async function getPortfolio(): Promise<PortfolioView | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  await getQuote(PRIMARY_SYMBOL).catch(() => null);

  const [holdingsResult, walletResult, positionsResult] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "id, asset_id, quantity, average_cost, realized_pnl, assets(symbol, name, currency, market_quotes(price, previous_close))",
      )
      .gt("quantity", 0),
    supabase.from("wallets").select("*").eq("currency", "USD").maybeSingle<Wallet>(),
    supabase
      .from("investment_positions")
      .select("principal, current_value")
      .eq("status", "active"),
  ]);

  const rows = (holdingsResult.data ?? []) as unknown as HoldingRow[];

  const holdings: HoldingInput[] = rows.map((row) => ({
    symbol: row.assets?.symbol ?? "—",
    name: row.assets?.name ?? "—",
    quantity: Number(row.quantity),
    averageCost: Number(row.average_cost),
    currentPrice: Number(row.assets?.market_quotes?.price ?? row.average_cost),
    previousClose: Number(row.assets?.market_quotes?.previous_close ?? row.average_cost),
    realizedPnl: Number(row.realized_pnl),
  }));

  const positions = (positionsResult.data ?? []) as { principal: number; current_value: number }[];
  const investedValue = positions.reduce((sum, p) => sum + Number(p.current_value), 0);
  const investedPrincipal = positions.reduce((sum, p) => sum + Number(p.principal), 0);
  const realizedPnl = rows.reduce((sum, row) => sum + Number(row.realized_pnl), 0);

  const wallet = walletResult.data ?? null;

  const summary = summarisePortfolio({
    holdings,
    cashBalance: Number(wallet?.available_balance ?? 0),
    reservedBalance: Number(wallet?.reserved_balance ?? 0),
    pendingBalance: Number(wallet?.pending_balance ?? 0),
    investedValue,
    investedPrincipal,
    realizedPnl,
  });

  return { ...summary, allocation: buildAllocation(summary), wallet };
}

/** Daily value history used by the portfolio performance chart. */
export async function getPortfolioHistory(days: number | null): Promise<PortfolioSnapshot[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("portfolio_snapshots")
    .select("*")
    .order("captured_on", { ascending: true });

  if (days) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    query = query.gte("captured_on", since);
  }

  const { data } = await query.returns<PortfolioSnapshot[]>();
  return data ?? [];
}

/** The caller's holding in one asset, used to pre-fill the order ticket. */
export async function getHoldingForAsset(assetId: string): Promise<{ quantity: number; averageCost: number }> {
  const supabase = await createClient();
  if (!supabase) return { quantity: 0, averageCost: 0 };

  const { data } = await supabase
    .from("portfolio_holdings")
    .select("quantity, average_cost")
    .eq("asset_id", assetId)
    .maybeSingle<{ quantity: number; average_cost: number }>();

  return {
    quantity: Number(data?.quantity ?? 0),
    averageCost: Number(data?.average_cost ?? 0),
  };
}
