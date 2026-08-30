import { describe, expect, it } from "vitest";
import { estimateOrder, isMarketable, maxAffordableQuantity } from "@/lib/calculations/orders";

const base = {
  marketPrice: 250,
  availableCash: 10_000,
  positionQuantity: 0,
  averageCost: 0,
};

describe("estimateOrder — buys", () => {
  it("prices a market buy at the live quote and charges no sell fee", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "market",
      quantity: 10,
    });

    expect(estimate.referencePrice).toBe(250);
    expect(estimate.notional).toBe(2500);
    expect(estimate.fees).toBe(0);
    expect(estimate.total).toBe(2500);
    expect(estimate.cashAfter).toBe(7500);
    expect(estimate.errors).toHaveLength(0);
  });

  it("blocks a buy that exceeds available cash", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "market",
      quantity: 100,
    });

    expect(estimate.errors).toContain("Insufficient cash for this order.");
  });

  it("caps the reference price of a limit buy at the limit", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "limit",
      quantity: 4,
      limitPrice: 240,
    });

    // The market is above the limit, so the order rests rather than filling.
    expect(estimate.referencePrice).toBe(240);
    expect(estimate.marketable).toBe(false);
    expect(estimate.warnings.join(" ")).toContain("not marketable");
  });

  it("recomputes the average cost after adding to an existing position", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "market",
      quantity: 10,
      positionQuantity: 10,
      averageCost: 150,
    });

    expect(estimate.positionAfter).toBe(20);
    expect(estimate.averageCostAfter).toBe(200);
  });

  it("requires a limit price on a limit order", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "limit",
      quantity: 1,
      limitPrice: null,
    });

    expect(estimate.errors).toContain("Enter a limit price.");
  });
});

describe("estimateOrder — sells", () => {
  it("charges the regulatory fee on the proceeds and credits the remainder", () => {
    const estimate = estimateOrder({
      ...base,
      side: "sell",
      orderType: "market",
      quantity: 10,
      positionQuantity: 10,
      averageCost: 200,
    });

    expect(estimate.notional).toBe(2500);
    expect(estimate.fees).toBeGreaterThan(0);
    expect(estimate.total).toBe(2500 - estimate.fees);
    expect(estimate.cashAfter).toBe(10_000 + estimate.total);
  });

  it("blocks a sell larger than the position", () => {
    const estimate = estimateOrder({
      ...base,
      side: "sell",
      orderType: "market",
      quantity: 20,
      positionQuantity: 10,
      averageCost: 200,
    });

    expect(estimate.errors).toContain("You do not hold enough of this asset to sell.");
  });

  it("clears the average cost when the position is fully closed", () => {
    const estimate = estimateOrder({
      ...base,
      side: "sell",
      orderType: "market",
      quantity: 10,
      positionQuantity: 10,
      averageCost: 200,
    });

    expect(estimate.positionAfter).toBe(0);
    expect(estimate.averageCostAfter).toBe(0);
  });
});

describe("estimateOrder — validation", () => {
  it("rejects a zero quantity", () => {
    const estimate = estimateOrder({ ...base, side: "buy", orderType: "market", quantity: 0 });
    expect(estimate.errors).toContain("Enter a quantity greater than zero.");
  });

  it("rejects an order above the platform notional limit", () => {
    const estimate = estimateOrder({
      ...base,
      side: "sell",
      orderType: "market",
      quantity: 100_000,
      positionQuantity: 100_000,
      availableCash: 0,
    });

    expect(estimate.errors).toContain("Order value exceeds the platform limit.");
  });

  it("does not produce NaN from a non-finite quantity", () => {
    const estimate = estimateOrder({
      ...base,
      side: "buy",
      orderType: "market",
      quantity: Number.NaN,
    });

    expect(Number.isNaN(estimate.notional)).toBe(false);
    expect(estimate.errors.length).toBeGreaterThan(0);
  });
});

describe("isMarketable", () => {
  it("treats a market order as always marketable", () => {
    expect(isMarketable({ side: "buy", orderType: "market" }, 250)).toBe(true);
  });

  it("fills a limit buy only at or below the limit", () => {
    expect(isMarketable({ side: "buy", orderType: "limit", limitPrice: 260 }, 250)).toBe(true);
    expect(isMarketable({ side: "buy", orderType: "limit", limitPrice: 240 }, 250)).toBe(false);
  });

  it("fills a limit sell only at or above the limit", () => {
    expect(isMarketable({ side: "sell", orderType: "limit", limitPrice: 240 }, 250)).toBe(true);
    expect(isMarketable({ side: "sell", orderType: "limit", limitPrice: 260 }, 250)).toBe(false);
  });

  it("triggers a buy stop once the market reaches the stop", () => {
    expect(isMarketable({ side: "buy", orderType: "stop", stopPrice: 245 }, 250)).toBe(true);
    expect(isMarketable({ side: "buy", orderType: "stop", stopPrice: 255 }, 250)).toBe(false);
  });

  it("triggers a sell stop once the market falls to the stop", () => {
    expect(isMarketable({ side: "sell", orderType: "stop", stopPrice: 255 }, 250)).toBe(true);
    expect(isMarketable({ side: "sell", orderType: "stop", stopPrice: 245 }, 250)).toBe(false);
  });

  it("requires both bounds on a stop-limit order", () => {
    expect(
      isMarketable({ side: "buy", orderType: "stop_limit", stopPrice: 245, limitPrice: 255 }, 250),
    ).toBe(true);
    expect(
      isMarketable({ side: "buy", orderType: "stop_limit", stopPrice: 245, limitPrice: 248 }, 250),
    ).toBe(false);
    expect(isMarketable({ side: "buy", orderType: "stop_limit", stopPrice: 245 }, 250)).toBe(false);
  });
});

describe("maxAffordableQuantity", () => {
  it("returns the quantity the cash balance covers", () => {
    expect(maxAffordableQuantity(1000, 250)).toBe(4);
  });

  it("returns zero for a non-positive price rather than dividing by zero", () => {
    expect(maxAffordableQuantity(1000, 0)).toBe(0);
  });
});
