import type { Candle } from "./types";

export interface IndicatorPoint {
  time: number;
  value: number;
}

/** Simple moving average. */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  if (period <= 0 || candles.length < period) return [];
  const out: IndicatorPoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

/** Exponential moving average, seeded with the first `period` SMA. */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  if (period <= 0 || candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: IndicatorPoint[] = [];

  let seed = 0;
  for (let i = 0; i < period; i++) seed += candles[i].close;
  let prev = seed / period;
  out.push({ time: candles[period - 1].time, value: prev });

  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

/** Wilder-smoothed relative strength index. */
export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length <= period) return [];
  const out: IndicatorPoint[] = [];

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const push = (time: number) => {
    const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
    out.push({ time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
  };
  push(candles[period].time);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    push(candles[i].time);
  }
  return out;
}

export interface MacdResult {
  macd: IndicatorPoint[];
  signal: IndicatorPoint[];
  histogram: IndicatorPoint[];
}

/** MACD (12, 26, 9 by default). */
export function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(candles, fast);
  const slowEma = ema(candles, slow);
  if (!fastEma.length || !slowEma.length) return { macd: [], signal: [], histogram: [] };

  const fastByTime = new Map(fastEma.map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = [];
  for (const point of slowEma) {
    const f = fastByTime.get(point.time);
    if (f !== undefined) macdLine.push({ time: point.time, value: f - point.value });
  }
  if (macdLine.length < signalPeriod) return { macd: macdLine, signal: [], histogram: [] };

  // Signal line = EMA of the MACD line.
  const k = 2 / (signalPeriod + 1);
  let seed = 0;
  for (let i = 0; i < signalPeriod; i++) seed += macdLine[i].value;
  let prev = seed / signalPeriod;

  const signal: IndicatorPoint[] = [{ time: macdLine[signalPeriod - 1].time, value: prev }];
  for (let i = signalPeriod; i < macdLine.length; i++) {
    prev = macdLine[i].value * k + prev * (1 - k);
    signal.push({ time: macdLine[i].time, value: prev });
  }

  const signalByTime = new Map(signal.map((p) => [p.time, p.value]));
  const histogram: IndicatorPoint[] = [];
  for (const point of macdLine) {
    const s = signalByTime.get(point.time);
    if (s !== undefined) histogram.push({ time: point.time, value: point.value - s });
  }

  return { macd: macdLine, signal, histogram };
}
