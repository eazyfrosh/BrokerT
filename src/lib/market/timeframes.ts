import type { CandleInterval, Timeframe } from "./types";

interface TimeframeSpec {
  label: Timeframe;
  /** Candle interval stored in `market_candles`. */
  interval: CandleInterval;
  /** Lookback window in days; null means "everything we hold". */
  days: number | null;
  /** Intraday timeframes are synthesised from the live quote path. */
  intraday: boolean;
}

export const TIMEFRAMES: Record<Timeframe, TimeframeSpec> = {
  "1D": { label: "1D", interval: "5m", days: 1, intraday: true },
  "5D": { label: "5D", interval: "15m", days: 5, intraday: true },
  "1M": { label: "1M", interval: "1d", days: 31, intraday: false },
  "3M": { label: "3M", interval: "1d", days: 93, intraday: false },
  "6M": { label: "6M", interval: "1d", days: 186, intraday: false },
  "1Y": { label: "1Y", interval: "1d", days: 366, intraday: false },
  "5Y": { label: "5Y", interval: "1w", days: 1830, intraday: false },
  MAX: { label: "MAX", interval: "1w", days: null, intraday: false },
};

export const TIMEFRAME_ORDER: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"];

export function isTimeframe(value: string): value is Timeframe {
  return value in TIMEFRAMES;
}
