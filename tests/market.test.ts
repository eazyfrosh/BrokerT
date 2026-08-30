import { describe, expect, it } from "vitest";
import { getMarketStatus } from "@/lib/market/session";
import { TIMEFRAMES, TIMEFRAME_ORDER, isTimeframe } from "@/lib/market/timeframes";
import { simulateStrategyHistory } from "@/lib/simulation";

describe("getMarketStatus", () => {
  // 14:30 UTC is 09:30 in New York during daylight time.
  it("reports the regular session as open", () => {
    const status = getMarketStatus(new Date("2026-08-31T15:00:00Z"));
    expect(status.state).toBe("open");
    expect(status.isOpen).toBe(true);
  });

  it("reports pre-market before the open", () => {
    const status = getMarketStatus(new Date("2026-08-31T12:00:00Z"));
    expect(status.state).toBe("pre_market");
    expect(status.isOpen).toBe(false);
  });

  it("reports after-hours following the close", () => {
    const status = getMarketStatus(new Date("2026-08-31T21:00:00Z"));
    expect(status.state).toBe("after_hours");
    expect(status.isOpen).toBe(false);
  });

  it("reports closed overnight", () => {
    const status = getMarketStatus(new Date("2026-08-31T06:00:00Z"));
    expect(status.state).toBe("closed");
  });

  it("reports closed at the weekend even during session hours", () => {
    // 2026-08-30 is a Sunday.
    const status = getMarketStatus(new Date("2026-08-30T15:00:00Z"));
    expect(status.state).toBe("closed");
    expect(status.isOpen).toBe(false);
  });

  it("always supplies a human-readable label", () => {
    for (const iso of [
      "2026-08-31T06:00:00Z",
      "2026-08-31T12:00:00Z",
      "2026-08-31T15:00:00Z",
      "2026-08-31T21:00:00Z",
    ]) {
      expect(getMarketStatus(new Date(iso)).label.length).toBeGreaterThan(0);
    }
  });
});

describe("timeframes", () => {
  it("defines every timeframe in the display order", () => {
    for (const timeframe of TIMEFRAME_ORDER) {
      expect(TIMEFRAMES[timeframe]).toBeDefined();
    }
    expect(TIMEFRAME_ORDER).toHaveLength(8);
  });

  it("marks only the short windows as intraday", () => {
    expect(TIMEFRAMES["1D"].intraday).toBe(true);
    expect(TIMEFRAMES["5D"].intraday).toBe(true);
    expect(TIMEFRAMES["1M"].intraday).toBe(false);
    expect(TIMEFRAMES.MAX.intraday).toBe(false);
  });

  it("increases the lookback window monotonically", () => {
    const windows = TIMEFRAME_ORDER.map((key) => TIMEFRAMES[key].days).filter(
      (days): days is number => days !== null,
    );
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]).toBeGreaterThan(windows[i - 1]);
    }
  });

  it("narrows an arbitrary string", () => {
    expect(isTimeframe("1Y")).toBe(true);
    expect(isTimeframe("42Y")).toBe(false);
  });
});

describe("simulateStrategyHistory", () => {
  const options = {
    seed: "ev-supply-chain",
    months: 24,
    annualReturnPct: 11.5,
    riskLevel: "growth",
  };

  it("is deterministic for a given seed", () => {
    const a = simulateStrategyHistory(options);
    const b = simulateStrategyHistory(options);
    expect(a).toEqual(b);
  });

  it("produces a different series for a different seed", () => {
    const a = simulateStrategyHistory(options);
    const b = simulateStrategyHistory({ ...options, seed: "autonomy-and-ai" });
    expect(a).not.toEqual(b);
  });

  it("returns one point per month plus the starting point", () => {
    expect(simulateStrategyHistory(options)).toHaveLength(25);
  });

  it("starts at the requested base value", () => {
    const points = simulateStrategyHistory({ ...options, startValue: 10_000 });
    expect(points[0].value).toBe(10_000);
  });

  it("moves a higher-risk strategy around more month to month", () => {
    // Compare realised volatility, not the absolute range: a low-volatility
    // path with the same drift can still end up spanning a wider price range.
    const realisedVolatility = (riskLevel: string) => {
      const values = simulateStrategyHistory({ ...options, riskLevel, months: 120 }).map((p) => p.value);
      const returns = values.slice(1).map((value, i) => Math.abs(Math.log(value / values[i])));
      return returns.reduce((sum, value) => sum + value, 0) / returns.length;
    };
    expect(realisedVolatility("aggressive")).toBeGreaterThan(realisedVolatility("conservative"));
  });

  it("never produces a negative or non-finite value", () => {
    for (const point of simulateStrategyHistory({ ...options, riskLevel: "aggressive", months: 120 })) {
      expect(Number.isFinite(point.value)).toBe(true);
      expect(point.value).toBeGreaterThan(0);
    }
  });
});
