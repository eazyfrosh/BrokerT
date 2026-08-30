import { TRADING } from "@/lib/config";
import { round } from "@/lib/utils";
import type { OrderSide, OrderType } from "@/types/database";

export interface OrderEstimateInput {
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  marketPrice: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  availableCash: number;
  positionQuantity: number;
  averageCost?: number;
}

export interface OrderEstimate {
  /** Price the estimate is based on. Market orders use the live quote. */
  referencePrice: number;
  notional: number;
  fees: number;
  /** Cash leaving (buy) or arriving (sell) the account. */
  total: number;
  cashAfter: number;
  positionAfter: number;
  averageCostAfter: number;
  /** True when the order would execute against the current quote. */
  marketable: boolean;
  /** Blocking problems — the order cannot be submitted while any are present. */
  errors: string[];
  /** Non-blocking notes worth showing on the preview. */
  warnings: string[];
}

/**
 * Mirrors the arithmetic in `public.place_order()` so the preview a user
 * confirms matches what the database will do. The database remains the
 * authority — this is a preview, never the source of truth.
 */
export function estimateOrder(input: OrderEstimateInput): OrderEstimate {
  const errors: string[] = [];
  const warnings: string[] = [];

  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0;
  const marketPrice = input.marketPrice;

  let referencePrice = marketPrice;
  if (input.orderType === "limit" || input.orderType === "stop_limit") {
    const limit = input.limitPrice ?? 0;
    if (limit > 0) {
      referencePrice = input.side === "buy" ? Math.min(marketPrice, limit) : Math.max(marketPrice, limit);
    }
  }

  const marketable = isMarketable(input, marketPrice);

  const notional = round(quantity * referencePrice, 2);
  const fees = input.side === "sell" ? round(notional * TRADING.sellFeeRate, 2) : round(TRADING.flatFee, 2);
  const total = input.side === "buy" ? round(notional + fees, 2) : round(notional - fees, 2);

  const cashAfter = round(input.side === "buy" ? input.availableCash - total : input.availableCash + total, 2);
  const positionAfter = round(
    input.side === "buy" ? input.positionQuantity + quantity : input.positionQuantity - quantity,
    8,
  );

  let averageCostAfter = input.averageCost ?? 0;
  if (input.side === "buy" && positionAfter > 0) {
    const priorCost = input.positionQuantity * (input.averageCost ?? 0);
    averageCostAfter = round((priorCost + quantity * referencePrice) / positionAfter, 8);
  } else if (input.side === "sell" && positionAfter === 0) {
    averageCostAfter = 0;
  }

  if (quantity <= 0) {
    errors.push("Enter a quantity greater than zero.");
  } else if (quantity < TRADING.minimumOrderQuantity) {
    errors.push(`Minimum order quantity is ${TRADING.minimumOrderQuantity}.`);
  }

  if (notional > TRADING.maximumOrderNotional) {
    errors.push("Order value exceeds the platform limit.");
  }

  if ((input.orderType === "limit" || input.orderType === "stop_limit") && !(input.limitPrice ?? 0)) {
    errors.push("Enter a limit price.");
  }
  if ((input.orderType === "stop" || input.orderType === "stop_limit") && !(input.stopPrice ?? 0)) {
    errors.push("Enter a stop price.");
  }

  if (input.side === "buy" && quantity > 0 && total > input.availableCash) {
    errors.push("Insufficient cash for this order.");
  }
  if (input.side === "sell" && quantity > input.positionQuantity) {
    errors.push("You do not hold enough of this asset to sell.");
  }

  if (!marketable && errors.length === 0 && quantity > 0) {
    warnings.push("This order is not marketable right now and will rest until your price is reached.");
  }
  if (input.side === "buy" && marketable && input.orderType === "market") {
    warnings.push("Market orders fill at the prevailing price, which may differ from the estimate.");
  }

  return {
    referencePrice: round(referencePrice, 4),
    notional,
    fees,
    total,
    cashAfter,
    positionAfter,
    averageCostAfter,
    marketable,
    errors,
    warnings,
  };
}

/** Would this order execute against the current quote? */
export function isMarketable(
  input: Pick<OrderEstimateInput, "side" | "orderType" | "limitPrice" | "stopPrice">,
  marketPrice: number,
): boolean {
  const limit = input.limitPrice ?? 0;
  const stop = input.stopPrice ?? 0;

  switch (input.orderType) {
    case "market":
      return true;
    case "limit":
      if (!limit) return false;
      return input.side === "buy" ? marketPrice <= limit : marketPrice >= limit;
    case "stop":
      if (!stop) return false;
      return input.side === "buy" ? marketPrice >= stop : marketPrice <= stop;
    case "stop_limit":
      if (!stop || !limit) return false;
      return input.side === "buy"
        ? marketPrice >= stop && marketPrice <= limit
        : marketPrice <= stop && marketPrice >= limit;
    default:
      return false;
  }
}

/** Largest quantity affordable with the available cash, after fees. */
export function maxAffordableQuantity(availableCash: number, price: number): number {
  if (price <= 0) return 0;
  const usable = Math.max(availableCash - TRADING.flatFee, 0);
  const gross = usable / (price * (1 + TRADING.commissionRate));
  return Math.max(round(gross, 6), 0);
}
