import { round } from "@/lib/utils";

export interface HoldingInput {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  previousClose: number;
  realizedPnl?: number;
}

export interface HoldingValuation extends HoldingInput {
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  returnPercent: number;
  dayPnl: number;
  dayReturnPercent: number;
  weight: number;
}

/**
 * Values a single holding.
 *
 *   marketValue    = quantity × currentPrice
 *   unrealizedPnL  = (currentPrice − averageCost) × quantity
 *   returnPercent  = unrealizedPnL / costBasis × 100
 */
export function valueHolding(input: HoldingInput): Omit<HoldingValuation, "weight"> {
  const costBasis = round(input.quantity * input.averageCost, 2);
  const marketValue = round(input.quantity * input.currentPrice, 2);
  const unrealizedPnl = round(marketValue - costBasis, 2);
  const returnPercent = costBasis > 0 ? round((unrealizedPnl / costBasis) * 100, 2) : 0;
  const previousValue = round(input.quantity * input.previousClose, 2);
  const dayPnl = round(marketValue - previousValue, 2);
  const dayReturnPercent = previousValue > 0 ? round((dayPnl / previousValue) * 100, 2) : 0;

  return {
    ...input,
    costBasis,
    marketValue,
    unrealizedPnl,
    returnPercent,
    dayPnl,
    dayReturnPercent,
  };
}

export interface PortfolioSummary {
  holdings: HoldingValuation[];
  holdingsValue: number;
  costBasis: number;
  cashBalance: number;
  reservedBalance: number;
  pendingBalance: number;
  investedValue: number;
  investedPrincipal: number;
  totalValue: number;
  totalInvested: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  totalReturnPercent: number;
  dayPnl: number;
  dayReturnPercent: number;
}

export interface PortfolioInputs {
  holdings: HoldingInput[];
  cashBalance: number;
  reservedBalance?: number;
  pendingBalance?: number;
  /** Current value of open investment-product allocations. */
  investedValue?: number;
  /** Principal originally allocated to those products. */
  investedPrincipal?: number;
  realizedPnl?: number;
}

/**
 * Builds the whole-account view.
 *
 *   totalValue = Σ holding market value + cash + open investment value
 *
 * Every figure here is derived — nothing is stored pre-computed, so the value
 * shown always reflects the current quote and the current holdings.
 */
export function summarisePortfolio(inputs: PortfolioInputs): PortfolioSummary {
  const valued = inputs.holdings.map(valueHolding);

  const holdingsValue = round(valued.reduce((sum, h) => sum + h.marketValue, 0), 2);
  const costBasis = round(valued.reduce((sum, h) => sum + h.costBasis, 0), 2);
  const dayPnl = round(valued.reduce((sum, h) => sum + h.dayPnl, 0), 2);
  const previousValue = round(holdingsValue - dayPnl, 2);

  const cashBalance = round(inputs.cashBalance, 2);
  const reservedBalance = round(inputs.reservedBalance ?? 0, 2);
  const pendingBalance = round(inputs.pendingBalance ?? 0, 2);
  const investedValue = round(inputs.investedValue ?? 0, 2);
  const investedPrincipal = round(inputs.investedPrincipal ?? 0, 2);
  const realizedPnl = round(inputs.realizedPnl ?? 0, 2);

  const totalValue = round(holdingsValue + cashBalance + reservedBalance + investedValue, 2);
  const totalInvested = round(costBasis + investedPrincipal, 2);

  const unrealizedPnl = round(holdingsValue - costBasis, 2);
  const investmentPnl = round(investedValue - investedPrincipal, 2);
  const totalPnl = round(unrealizedPnl + investmentPnl + realizedPnl, 2);
  const totalReturnPercent = totalInvested > 0 ? round((totalPnl / totalInvested) * 100, 2) : 0;

  const holdings: HoldingValuation[] = valued.map((h) => ({
    ...h,
    weight: totalValue > 0 ? round((h.marketValue / totalValue) * 100, 2) : 0,
  }));

  return {
    holdings,
    holdingsValue,
    costBasis,
    cashBalance,
    reservedBalance,
    pendingBalance,
    investedValue,
    investedPrincipal,
    totalValue,
    totalInvested,
    unrealizedPnl,
    realizedPnl,
    totalPnl,
    totalReturnPercent,
    dayPnl,
    dayReturnPercent: previousValue > 0 ? round((dayPnl / previousValue) * 100, 2) : 0,
  };
}

export interface AllocationSlice {
  label: string;
  value: number;
  percent: number;
}

/** Allocation breakdown across holdings, open investments and cash. */
export function buildAllocation(summary: PortfolioSummary): AllocationSlice[] {
  const slices: { label: string; value: number }[] = [
    ...summary.holdings.map((h) => ({ label: h.symbol, value: h.marketValue })),
  ];
  if (summary.investedValue > 0) slices.push({ label: "Investment products", value: summary.investedValue });
  const cash = round(summary.cashBalance + summary.reservedBalance, 2);
  if (cash > 0) slices.push({ label: "Cash", value: cash });

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return slices
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, percent: total > 0 ? round((s.value / total) * 100, 2) : 0 }))
    .sort((a, b) => b.value - a.value);
}
