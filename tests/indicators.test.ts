import { describe, expect, it } from "vitest";
import { sma, ema, rsi, macd } from "@/lib/market/indicators";
import type { Candle } from "@/lib/market/types";

function series(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    time: 1_700_000_000 + index * 86_400,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));
}

describe("sma", () => {
  it("averages the trailing window", () => {
    const result = sma(series([1, 2, 3, 4, 5]), 3);
    expect(result.map((point) => point.value)).toEqual([2, 3, 4]);
  });

  it("returns nothing when the series is shorter than the period", () => {
    expect(sma(series([1, 2]), 5)).toEqual([]);
  });

  it("starts at the first complete window", () => {
    const candles = series([1, 2, 3, 4, 5]);
    expect(sma(candles, 3)[0].time).toBe(candles[2].time);
  });
});

describe("ema", () => {
  it("seeds from the simple average of the first window", () => {
    const result = ema(series([1, 2, 3, 4, 5]), 3);
    expect(result[0].value).toBe(2);
  });

  it("weights recent values more heavily than a simple average", () => {
    const closes = [10, 10, 10, 10, 20];
    const simple = sma(series(closes), 3).at(-1)!.value;
    const exponential = ema(series(closes), 3).at(-1)!.value;
    expect(exponential).toBeGreaterThan(simple);
  });

  it("converges on a flat series", () => {
    const result = ema(series([5, 5, 5, 5, 5, 5]), 3);
    expect(result.at(-1)!.value).toBeCloseTo(5, 6);
  });
});

describe("rsi", () => {
  it("reads 100 when every move is upward", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(series(closes), 14).at(-1)!.value).toBe(100);
  });

  it("reads 0 when every move is downward", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(series(closes), 14).at(-1)!.value).toBeCloseTo(0, 6);
  });

  it("stays within 0 and 100 on a mixed series", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    for (const point of rsi(series(closes), 14)) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it("returns nothing when the series is too short", () => {
    expect(rsi(series([1, 2, 3]), 14)).toEqual([]);
  });
});

describe("macd", () => {
  it("produces aligned macd, signal and histogram lines", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 8 + i * 0.2);
    const result = macd(series(closes));

    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBe(result.signal.length);

    const signalByTime = new Map(result.signal.map((point) => [point.time, point.value]));
    const macdByTime = new Map(result.macd.map((point) => [point.time, point.value]));
    for (const point of result.histogram) {
      expect(point.value).toBeCloseTo(macdByTime.get(point.time)! - signalByTime.get(point.time)!, 8);
    }
  });

  it("is positive while a series trends up", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i);
    expect(macd(series(closes)).macd.at(-1)!.value).toBeGreaterThan(0);
  });

  it("returns empty lines for a series that is too short", () => {
    const result = macd(series([1, 2, 3]));
    expect(result.macd).toEqual([]);
    expect(result.signal).toEqual([]);
  });
});
