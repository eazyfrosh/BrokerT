import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  formatCompactCurrency,
  initialsOf,
  titleCase,
} from "@/lib/format";
import { round, generateReference, clamp } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats a positive amount", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("uses a true minus sign for negatives rather than a hyphen", () => {
    expect(formatCurrency(-1234.5)).toBe("−$1,234.50");
  });

  it("shows an explicit sign when asked", () => {
    expect(formatCurrency(12.4, { signed: true })).toBe("+$12.40");
    expect(formatCurrency(-12.4, { signed: true })).toBe("−$12.40");
  });

  it("renders a dash for missing values instead of $0.00 or NaN", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("honours a decimal override", () => {
    expect(formatCurrency(1234.56, { decimals: 0 })).toBe("$1,235");
  });
});

describe("formatPercent", () => {
  it("signs the value by default", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-1.234)).toBe("−1.23%");
  });

  it("omits the plus when signing is turned off", () => {
    expect(formatPercent(12, { signed: false })).toBe("12.00%");
  });

  it("renders a dash for missing values", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatQuantity", () => {
  it("shows whole share counts without decimals", () => {
    expect(formatQuantity(10)).toBe("10");
  });

  it("preserves fractional quantities", () => {
    expect(formatQuantity(0.125)).toBe("0.125");
  });
});

describe("formatCompactCurrency", () => {
  it("abbreviates large values", () => {
    expect(formatCompactCurrency(1_250_000)).toBe("$1.25M");
  });
});

describe("initialsOf", () => {
  it("builds initials from both names", () => {
    expect(initialsOf("Ada", "Lovelace")).toBe("AL");
  });

  it("falls back when no name is set", () => {
    expect(initialsOf(null, null, "?")).toBe("?");
  });
});

describe("titleCase", () => {
  it("converts a snake-case status into words", () => {
    expect(titleCase("partially_filled")).toBe("Partially Filled");
    expect(titleCase("order_request")).toBe("Order Request");
  });
});

describe("round", () => {
  it("rounds to cents without float drift", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
  });

  it("supports higher precision for quantities", () => {
    expect(round(0.123456789, 6)).toBe(0.123457);
  });
});

describe("clamp", () => {
  it("bounds a value on both sides", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe("generateReference", () => {
  it("uses the prefix and a fixed-length body", () => {
    expect(generateReference("ORD")).toMatch(/^ORD-[A-HJKMNP-Z2-9]{8}$/);
  });

  it("omits the characters that are easy to confuse when read aloud", () => {
    // The alphabet drops I, L, O, 0 and 1 — the pairs people actually mistype.
    for (let i = 0; i < 200; i++) {
      expect(generateReference("TXN")).not.toMatch(/[ILO01]/);
    }
  });

  it("does not repeat across many draws", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateReference("INV")));
    expect(seen.size).toBe(500);
  });
});
