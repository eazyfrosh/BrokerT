import { describe, expect, it } from "vitest";
import {
  measureInvestmentPosition,
  capacityProgress,
} from "@/lib/calculations/investments";

describe("measureInvestmentPosition", () => {
  const position = {
    principal: 10_000,
    currentValue: 10_800,
    targetReturnPct: 12,
    startDate: "2026-01-01",
    targetDate: "2027-01-01",
  };

  it("computes gain and gain percentage from principal", () => {
    const metrics = measureInvestmentPosition(position, new Date("2026-07-02T00:00:00Z"));
    expect(metrics.gain).toBe(800);
    expect(metrics.gainPercent).toBe(8);
  });

  it("derives progress from elapsed time, not from value", () => {
    const metrics = measureInvestmentPosition(position, new Date("2026-07-02T00:00:00Z"));
    expect(metrics.totalDays).toBe(365);
    expect(metrics.daysElapsed).toBe(182);
    expect(metrics.progressPercent).toBeCloseTo(49.86, 1);
  });

  it("clamps progress at the start of the term", () => {
    const metrics = measureInvestmentPosition(position, new Date("2025-06-01T00:00:00Z"));
    expect(metrics.daysElapsed).toBe(0);
    expect(metrics.progressPercent).toBe(0);
    expect(metrics.isMatured).toBe(false);
  });

  it("clamps progress at the end of the term and marks it matured", () => {
    const metrics = measureInvestmentPosition(position, new Date("2028-01-01T00:00:00Z"));
    expect(metrics.daysElapsed).toBe(365);
    expect(metrics.daysRemaining).toBe(0);
    expect(metrics.progressPercent).toBe(100);
    expect(metrics.isMatured).toBe(true);
  });

  it("projects the target value without treating it as achieved", () => {
    const metrics = measureInvestmentPosition(position, new Date("2026-07-02T00:00:00Z"));
    expect(metrics.projectedValue).toBe(11_200);
    // The projection is independent of the current value.
    expect(metrics.projectedValue).not.toBe(metrics.currentValue);
  });

  it("reports a loss when the current value is below principal", () => {
    const metrics = measureInvestmentPosition(
      { ...position, currentValue: 9_250 },
      new Date("2026-07-02T00:00:00Z"),
    );
    expect(metrics.gain).toBe(-750);
    expect(metrics.gainPercent).toBe(-7.5);
  });

  it("handles a same-day term without dividing by zero", () => {
    const metrics = measureInvestmentPosition(
      { ...position, startDate: "2026-01-01", targetDate: "2026-01-01" },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(metrics.totalDays).toBe(0);
    expect(metrics.progressPercent).toBe(100);
    expect(Number.isNaN(metrics.progressPercent)).toBe(false);
  });
});

describe("capacityProgress", () => {
  it("returns the percentage allocated", () => {
    expect(capacityProgress(2_500_000, 5_000_000)).toBe(50);
  });

  it("returns null when the product is uncapped", () => {
    expect(capacityProgress(1000, null)).toBeNull();
    expect(capacityProgress(1000, 0)).toBeNull();
  });

  it("clamps at 100 when over-allocated", () => {
    expect(capacityProgress(6_000_000, 5_000_000)).toBe(100);
  });
});
