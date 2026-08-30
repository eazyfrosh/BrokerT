import { describe, expect, it } from "vitest";
import {
  registerSchema,
  loginSchema,
  passwordSchema,
  placeOrderSchema,
  allocateInvestmentSchema,
  cashMovementSchema,
  carOrderSchema,
  adminInvestmentSchema,
  adminNotificationSchema,
} from "@/lib/validation/schemas";

describe("passwordSchema", () => {
  it("accepts a password meeting every rule", () => {
    expect(passwordSchema.safeParse("Correct-Horse-9!").success).toBe(true);
  });

  it.each([
    ["too short", "Ab1!xyz"],
    ["no uppercase", "correct-horse-9!"],
    ["no lowercase", "CORRECT-HORSE-9!"],
    ["no digit", "Correct-Horse-Xy!"],
    ["no symbol", "CorrectHorse99"],
    ["all one character", "aaaaaaaaaaaa"],
  ])("rejects a password with %s", (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "Ada@Example.com",
    password: "Correct-Horse-9!",
    confirmPassword: "Correct-Horse-9!",
    country: "United Kingdom",
    phone: "+44 20 7946 0000",
    acceptTerms: true as const,
  };

  it("accepts a complete registration and lowercases the email", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects mismatched passwords against the confirm field", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Different-Horse-9!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("rejects a password containing the email name", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "Ada-Password-9!",
      confirmPassword: "Ada-Password-9!",
    });
    expect(result.success).toBe(false);
  });

  it("requires the terms to be accepted", () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a name containing markup", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "<script>" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password so the form never leaks the policy", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("placeOrderSchema", () => {
  const assetId = "11111111-1111-4111-8111-111111111111";

  it("accepts a market order without price fields", () => {
    const result = placeOrderSchema.safeParse({
      assetId,
      side: "buy",
      orderType: "market",
      quantity: 5,
      timeInForce: "day",
    });
    expect(result.success).toBe(true);
  });

  it("requires a limit price on a limit order", () => {
    const result = placeOrderSchema.safeParse({
      assetId,
      side: "buy",
      orderType: "limit",
      quantity: 5,
    });
    expect(result.success).toBe(false);
  });

  it("requires a stop price on a stop order", () => {
    const result = placeOrderSchema.safeParse({
      assetId,
      side: "sell",
      orderType: "stop",
      quantity: 5,
    });
    expect(result.success).toBe(false);
  });

  it("requires both prices on a stop-limit order", () => {
    expect(
      placeOrderSchema.safeParse({
        assetId,
        side: "buy",
        orderType: "stop_limit",
        quantity: 5,
        stopPrice: 100,
      }).success,
    ).toBe(false);

    expect(
      placeOrderSchema.safeParse({
        assetId,
        side: "buy",
        orderType: "stop_limit",
        quantity: 5,
        stopPrice: 100,
        limitPrice: 110,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-positive quantity", () => {
    expect(
      placeOrderSchema.safeParse({ assetId, side: "buy", orderType: "market", quantity: 0 }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({ assetId, side: "buy", orderType: "market", quantity: -5 }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid asset id", () => {
    expect(
      placeOrderSchema.safeParse({ assetId: "tsla", side: "buy", orderType: "market", quantity: 1 })
        .success,
    ).toBe(false);
  });
});

describe("allocateInvestmentSchema", () => {
  const investmentId = "22222222-2222-4222-8222-222222222222";

  it("requires the risk acknowledgement", () => {
    expect(
      allocateInvestmentSchema.safeParse({ investmentId, amount: 1000, acknowledgeRisk: false }).success,
    ).toBe(false);
    expect(
      allocateInvestmentSchema.safeParse({ investmentId, amount: 1000, acknowledgeRisk: true }).success,
    ).toBe(true);
  });

  it("rejects more than two decimal places", () => {
    expect(
      allocateInvestmentSchema.safeParse({ investmentId, amount: 100.005, acknowledgeRisk: true })
        .success,
    ).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(
      allocateInvestmentSchema.safeParse({ investmentId, amount: 0, acknowledgeRisk: true }).success,
    ).toBe(false);
  });
});

describe("cashMovementSchema", () => {
  it("accepts a deposit and a withdrawal", () => {
    expect(cashMovementSchema.safeParse({ type: "deposit", amount: 500 }).success).toBe(true);
    expect(cashMovementSchema.safeParse({ type: "withdrawal", amount: 500 }).success).toBe(true);
  });

  it("rejects any other movement type", () => {
    expect(cashMovementSchema.safeParse({ type: "buy", amount: 500 }).success).toBe(false);
  });
});

describe("carOrderSchema", () => {
  const valid = {
    vehicleId: "33333333-3333-4333-8333-333333333333",
    trim: "long-range",
    exterior: "pearl-white",
    interior: "all-black",
    wheels: "aero-18",
    options: ["tow-hitch"],
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 555 000 0000",
    addressLine1: "1 Analytical Way",
    city: "London",
    region: "Greater London",
    postalCode: "W1A 1AA",
    country: "United Kingdom",
    acknowledgeDemo: true as const,
  };

  it("accepts a complete configuration", () => {
    expect(carOrderSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the demo acknowledgement", () => {
    expect(carOrderSchema.safeParse({ ...valid, acknowledgeDemo: false }).success).toBe(false);
  });

  it("requires every configuration choice", () => {
    expect(carOrderSchema.safeParse({ ...valid, trim: "" }).success).toBe(false);
    expect(carOrderSchema.safeParse({ ...valid, wheels: "" }).success).toBe(false);
  });
});

describe("adminInvestmentSchema", () => {
  const valid = {
    slug: "ev-supply-chain",
    name: "EV Supply Chain Basket",
    category: "Thematic basket",
    summary: "Diversified exposure across the electric-vehicle value chain.",
    riskLevel: "growth" as const,
    riskDisclosure:
      "Sector-concentrated strategies move with the fortunes of that sector and capital is at risk.",
    targetReturnPct: 11.5,
    durationMonths: 18,
    minimumAmount: 1000,
    managementFeePct: 0.65,
    performanceFeePct: 10,
    status: "open" as const,
  };

  it("accepts a complete strategy", () => {
    expect(adminInvestmentSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a substantive risk disclosure", () => {
    expect(adminInvestmentSchema.safeParse({ ...valid, riskDisclosure: "Risky." }).success).toBe(false);
    expect(adminInvestmentSchema.safeParse({ ...valid, riskDisclosure: "" }).success).toBe(false);
  });

  it("rejects a slug that is not url-safe", () => {
    expect(adminInvestmentSchema.safeParse({ ...valid, slug: "EV Supply Chain" }).success).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    expect(adminInvestmentSchema.safeParse({ ...valid, durationMonths: 0 }).success).toBe(false);
  });
});

describe("adminNotificationSchema", () => {
  it("accepts a broadcast to everyone", () => {
    expect(
      adminNotificationSchema.safeParse({
        title: "Scheduled maintenance",
        message: "The platform will be briefly unavailable on Sunday.",
        type: "system",
        target: "all",
      }).success,
    ).toBe(true);
  });

  it("rejects an over-long message", () => {
    expect(
      adminNotificationSchema.safeParse({
        title: "Notice",
        message: "x".repeat(1001),
        type: "system",
        target: "all",
      }).success,
    ).toBe(false);
  });
});
