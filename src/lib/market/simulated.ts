import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candle, CandleInterval, MarketDataProvider, MarketSeries, Quote, Timeframe } from "./types";
import { TIMEFRAMES } from "./timeframes";
import { getMarketStatus } from "./session";
import { round } from "@/lib/utils";

/** Minimum wall-clock gap between two simulated ticks, in milliseconds. */
const TICK_INTERVAL_MS = 4_000;
/** Annualised volatility used by the random walk. */
const ANNUAL_VOLATILITY = 0.55;
/** Trading seconds in a year (252 sessions x 6.5h). */
const TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600;

interface QuoteRow {
  asset_id: string;
  price: number;
  previous_close: number;
  open_price: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap: number | null;
  week52_high: number | null;
  week52_low: number | null;
  source: string;
  is_simulated: boolean;
  quoted_at: string;
  assets: { symbol: string; name: string; currency: string } | null;
}

/**
 * Advances a price by a geometric-Brownian-motion step.
 *
 * Deliberately mean-reverting toward the session open so a long-running demo
 * does not drift to an absurd number, and volatility is damped outside regular
 * trading hours.
 */
function nextPrice(current: number, anchor: number, elapsedSeconds: number, isOpen: boolean): number {
  const dt = Math.min(elapsedSeconds, 900) / TRADING_SECONDS_PER_YEAR;
  const vol = ANNUAL_VOLATILITY * (isOpen ? 1 : 0.25);

  // Box–Muller transform for a normally distributed shock.
  const u1 = Math.random() || Number.EPSILON;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  const diffusion = vol * Math.sqrt(dt) * z;
  const reversion = 0.35 * dt * Math.log(anchor / current);
  const next = current * Math.exp(reversion - 0.5 * vol * vol * dt + diffusion);

  // Never let the demo price run away from the session anchor.
  return round(Math.min(Math.max(next, anchor * 0.7), anchor * 1.3), 2);
}

function toQuote(row: QuoteRow): Quote {
  const change = row.price - row.previous_close;
  return {
    symbol: row.assets?.symbol ?? "—",
    name: row.assets?.name ?? "—",
    price: Number(row.price),
    previousClose: Number(row.previous_close),
    open: Number(row.open_price),
    dayHigh: Number(row.day_high),
    dayLow: Number(row.day_low),
    change: round(change, 2),
    changePercent: row.previous_close ? round((change / row.previous_close) * 100, 2) : 0,
    volume: Number(row.volume),
    marketCap: row.market_cap === null ? null : Number(row.market_cap),
    week52High: row.week52_high === null ? null : Number(row.week52_high),
    week52Low: row.week52_low === null ? null : Number(row.week52_low),
    currency: row.assets?.currency ?? "USD",
    source: row.source,
    isSimulated: row.is_simulated,
    quotedAt: row.quoted_at,
  };
}

const QUOTE_SELECT =
  "asset_id, price, previous_close, open_price, day_high, day_low, volume, market_cap, week52_high, week52_low, source, is_simulated, quoted_at, assets!inner(symbol, name, currency)";

/**
 * Demo market engine.
 *
 * Reads the canonical quote from Postgres, advances it when enough wall-clock
 * time has elapsed, and writes it back so that every user, the portfolio
 * valuation and the order engine all agree on one price.
 *
 * `writeClient` must be a service-role client (RLS blocks quote writes for
 * ordinary users); when it is absent the provider degrades to read-only.
 */
export class SimulatedMarketDataProvider implements MarketDataProvider {
  readonly id = "simulated";
  readonly isSimulated = true;

  constructor(
    private readonly readClient: SupabaseClient,
    private readonly writeClient: SupabaseClient | null = null,
  ) {}

  async getQuote(symbol: string): Promise<Quote | null> {
    const { data, error } = await this.readClient
      .from("market_quotes")
      .select(QUOTE_SELECT)
      .eq("assets.symbol", symbol)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as QuoteRow;

    const advanced = await this.advance(row);
    return toQuote(advanced);
  }

  /** Applies one or more simulated ticks and persists the result. */
  private async advance(row: QuoteRow): Promise<QuoteRow> {
    if (!this.writeClient) return row;

    const now = Date.now();
    const quotedAt = new Date(row.quoted_at).getTime();
    const elapsed = now - quotedAt;
    if (!Number.isFinite(elapsed) || elapsed < TICK_INTERVAL_MS) return row;

    const status = getMarketStatus(new Date(now));
    const anchor = Number(row.open_price) || Number(row.previous_close) || Number(row.price);
    const price = nextPrice(Number(row.price), anchor, elapsed / 1000, status.isOpen);

    // Volume accrues only while the session is open.
    const volumeDelta = status.isOpen
      ? Math.round((elapsed / 1000) * (2_000 + Math.random() * 6_000))
      : 0;

    const next: QuoteRow = {
      ...row,
      price,
      day_high: Math.max(Number(row.day_high), price),
      day_low: Math.min(Number(row.day_low), price),
      volume: Number(row.volume) + volumeDelta,
      week52_high: row.week52_high === null ? null : Math.max(Number(row.week52_high), price),
      week52_low: row.week52_low === null ? null : Math.min(Number(row.week52_low), price),
      quoted_at: new Date(now).toISOString(),
    };

    const { error: writeError } = await this.writeClient
      .from("market_quotes")
      .update({
        price: next.price,
        day_high: next.day_high,
        day_low: next.day_low,
        volume: next.volume,
        week52_high: next.week52_high,
        week52_low: next.week52_low,
        market_cap: row.market_cap === null ? null : round(next.price * 3_200_000_000, 2),
        quoted_at: next.quoted_at,
      })
      .eq("asset_id", row.asset_id);

    // A failed write is not fatal — serve the freshly computed tick anyway.
    if (writeError) return { ...row, price: next.price };

    // The price has moved, so resting limit and stop orders may now be
    // marketable. Settling them here is what makes the demo venue behave like
    // a venue rather than a queue that never clears. A failure must not break
    // the quote read, so it is logged and swallowed.
    const { error: fillError } = await this.writeClient.rpc("process_resting_orders", {
      p_asset_id: row.asset_id,
    });
    if (fillError) {
      console.error("[market] could not settle resting orders:", fillError.message);
    }

    return next;
  }

  async getSeries(symbol: string, timeframe: Timeframe): Promise<MarketSeries | null> {
    const spec = TIMEFRAMES[timeframe];

    const { data: asset } = await this.readClient
      .from("assets")
      .select("id, symbol")
      .eq("symbol", symbol)
      .maybeSingle<{ id: string; symbol: string }>();
    if (!asset) return null;

    if (spec.intraday) {
      const quote = await this.getQuote(symbol);
      if (!quote) return null;
      return {
        symbol,
        timeframe,
        interval: spec.interval,
        candles: this.synthesiseIntraday(quote, timeframe),
        isSimulated: true,
      };
    }

    const since = spec.days
      ? new Date(Date.now() - spec.days * 86_400_000).toISOString()
      : new Date(0).toISOString();

    const { data: rows } = await this.readClient
      .from("market_candles")
      .select("bucket_start, open, high, low, close, volume")
      .eq("asset_id", asset.id)
      .eq("interval", "1d")
      .gte("bucket_start", since)
      .order("bucket_start", { ascending: true })
      .limit(3000);

    let candles: Candle[] = (rows ?? []).map((r) => ({
      time: Math.floor(new Date(r.bucket_start as string).getTime() / 1000),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }));

    if (spec.interval === "1w") candles = aggregateWeekly(candles);

    return { symbol, timeframe, interval: spec.interval, candles, isSimulated: true };
  }

  /**
   * Intraday history is not persisted in demo mode; it is reconstructed from
   * the session's open/high/low/last so the 1D and 5D charts stay coherent
   * with the quote card above them.
   */
  private synthesiseIntraday(quote: Quote, timeframe: Timeframe): Candle[] {
    const spec = TIMEFRAMES[timeframe];
    const stepSeconds = spec.interval === "5m" ? 300 : 900;
    const sessions = timeframe === "1D" ? 1 : 5;
    const barsPerSession = Math.round((6.5 * 3600) / stepSeconds);
    const total = barsPerSession * sessions;

    const candles: Candle[] = [];
    const endTime = Math.floor(Date.now() / 1000);
    let price = quote.previousClose;
    const drift = (quote.price - quote.previousClose) / total;
    const band = Math.max(quote.dayHigh - quote.dayLow, quote.price * 0.004);

    // Deterministic per-bar jitter keyed to the bar's timestamp, so repeated
    // renders of the same window produce the same shape.
    for (let i = 0; i < total; i++) {
      const time = endTime - (total - i) * stepSeconds;
      const seed = Math.sin(time * 12.9898) * 43758.5453;
      const jitter = (seed - Math.floor(seed) - 0.5) * band * 0.35;
      const open = price;
      const close = round(quote.previousClose + drift * (i + 1) + jitter, 2);
      const high = round(Math.max(open, close) * (1 + Math.abs(jitter) / quote.price / 4), 2);
      const low = round(Math.min(open, close) * (1 - Math.abs(jitter) / quote.price / 4), 2);
      candles.push({
        time,
        open: round(open, 2),
        high,
        low,
        close,
        volume: Math.round(quote.volume / total),
      });
      price = close;
    }

    if (candles.length) {
      const last = candles[candles.length - 1];
      last.close = quote.price;
      last.high = Math.max(last.high, quote.price);
      last.low = Math.min(last.low, quote.price);
    }
    return candles;
  }
}

/** Collapses daily candles into weekly buckets (ISO weeks). */
function aggregateWeekly(candles: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const date = new Date(c.time * 1000);
    const day = (date.getUTCDay() + 6) % 7; // Monday = 0
    const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day) / 1000;

    const existing = buckets.get(monday);
    if (!existing) {
      buckets.set(monday, { ...c, time: monday });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export type { CandleInterval };
