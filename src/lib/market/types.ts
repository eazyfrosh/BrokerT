export type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";
export type ChartStyle = "line" | "area" | "candlestick";
export type IndicatorKey = "volume" | "sma" | "ema" | "rsi" | "macd";

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  week52High: number | null;
  week52Low: number | null;
  currency: string;
  source: string;
  isSimulated: boolean;
  quotedAt: string;
}

export interface Candle {
  /** Unix seconds — the format lightweight-charts expects. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSeries {
  symbol: string;
  interval: CandleInterval;
  timeframe: Timeframe;
  candles: Candle[];
  isSimulated: boolean;
}

/** Market session state, derived from US equity regular trading hours. */
export type MarketSessionState = "pre_market" | "open" | "after_hours" | "closed";

export interface MarketStatus {
  state: MarketSessionState;
  label: string;
  isOpen: boolean;
  nextChangeAt: string | null;
}

/**
 * The seam every market-data source implements. Swapping `simulated` for
 * Polygon / Finnhub / Twelve Data means writing one more implementation of
 * this interface and pointing MARKET_DATA_PROVIDER at it — nothing in the UI
 * or the trading engine changes.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly isSimulated: boolean;
  getQuote(symbol: string): Promise<Quote | null>;
  getSeries(symbol: string, timeframe: Timeframe): Promise<MarketSeries | null>;
}
