import { describe, expect, it } from "vitest";
import {
  valueHolding,
  summarisePortfolio,
  buildAllocation,
} from "@/lib/calculations/portfolio";

describe("valueHolding", () => {
  it("computes market value, unrealised P/L and return percentage", () => {
    const result = valueHolding({
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 10,
      averageCost: 200,
      currentPrice: 250,
      previousClose: 240,
    });

    expect(result.costBasis).toBe(2000);
    expect(result.marketValue).toBe(2500);
    expect(result.unrealizedPnl).toBe(500);
    expect(result.returnPercent).toBe(25);
  });

  it("computes the day move against the previous close, not the cost basis", () => {
    const result = valueHolding({
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 10,
      averageCost: 200,
      currentPrice: 250,
      previousClose: 240,
    });

    expect(result.dayPnl).toBe(100);
    expect(result.dayReturnPercent).toBeCloseTo(4.17, 2);
  });

  it("reports a loss when the price is below the average cost", () => {
    const result = valueHolding({
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 4,
      averageCost: 300,
      currentPrice: 240,
      previousClose: 250,
    });

    expect(result.unrealizedPnl).toBe(-240);
    expect(result.returnPercent).toBe(-20);
    expect(result.dayPnl).toBe(-40);
  });

  it("does not divide by zero when there is no cost basis", () => {
    const result = valueHolding({
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 0,
      averageCost: 0,
      currentPrice: 250,
      previousClose: 240,
    });

    expect(result.returnPercent).toBe(0);
    expect(result.dayReturnPercent).toBe(0);
  });

  it("handles fractional quantities without float drift in the cents", () => {
    const result = valueHolding({
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 0.3,
      averageCost: 199.99,
      currentPrice: 249.97,
      previousClose: 249.97,
    });

    expect(result.costBasis).toBe(60);
    expect(result.marketValue).toBe(74.99);
  });
});

describe("summarisePortfolio", () => {
  const inputs = {
    holdings: [
      {
        symbol: "TSLA",
        name: "Tesla, Inc.",
        quantity: 10,
        averageCost: 200,
        currentPrice: 250,
        previousClose: 240,
      },
    ],
    cashBalance: 5000,
    reservedBalance: 500,
    investedValue: 2200,
    investedPrincipal: 2000,
    realizedPnl: 150,
  };

  it("totals holdings, cash, reserved cash and open allocations", () => {
    const summary = summarisePortfolio(inputs);
    // 2500 holdings + 5000 cash + 500 reserved + 2200 allocations
    expect(summary.totalValue).toBe(10200);
  });

  it("counts cost basis and allocated principal as total invested", () => {
    const summary = summarisePortfolio(inputs);
    expect(summary.totalInvested).toBe(4000);
  });

  it("sums unrealised, allocation and realised P/L into total P/L", () => {
    const summary = summarisePortfolio(inputs);
    // 500 unrealised + 200 allocation + 150 realised
    expect(summary.totalPnl).toBe(850);
    expect(summary.totalReturnPercent).toBeCloseTo(21.25, 2);
  });

  it("returns zeroes for an empty account rather than NaN", () => {
    const summary = summarisePortfolio({ holdings: [], cashBalance: 0 });
    expect(summary.totalValue).toBe(0);
    expect(summary.totalReturnPercent).toBe(0);
    expect(summary.dayReturnPercent).toBe(0);
    expect(Number.isNaN(summary.totalPnl)).toBe(false);
  });

  it("weights each holding against the whole account, not just the holdings", () => {
    const summary = summarisePortfolio(inputs);
    expect(summary.holdings[0].weight).toBeCloseTo(24.51, 1);
  });
});

describe("buildAllocation", () => {
  it("includes holdings, allocations and cash, ordered by value", () => {
    const summary = summarisePortfolio({
      holdings: [
        {
          symbol: "TSLA",
          name: "Tesla, Inc.",
          quantity: 10,
          averageCost: 200,
          currentPrice: 250,
          previousClose: 250,
        },
      ],
      cashBalance: 5000,
      investedValue: 1000,
      investedPrincipal: 1000,
    });

    const slices = buildAllocation(summary);
    expect(slices.map((slice) => slice.label)).toEqual(["Cash", "TSLA", "Investment products"]);
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBeCloseTo(100, 1);
  });

  it("omits slices with no value", () => {
    const summary = summarisePortfolio({ holdings: [], cashBalance: 100 });
    expect(buildAllocation(summary)).toEqual([{ label: "Cash", value: 100, percent: 100 }]);
  });
});
