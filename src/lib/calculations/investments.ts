import { round, clamp } from "@/lib/utils";

export interface InvestmentPositionInput {
  principal: number;
  currentValue: number;
  targetReturnPct: number;
  startDate: string;
  targetDate: string;
}

export interface InvestmentPositionMetrics {
  principal: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
  /** 0–100: how far through the term the position is, by elapsed time. */
  progressPercent: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  /**
   * Illustrative value at the target date if the target return were achieved.
   * This is a projection, never a promise.
   */
  projectedValue: number;
  isMatured: boolean;
}

function toUtcDay(value: string): number {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function measureInvestmentPosition(
  input: InvestmentPositionInput,
  now: Date = new Date(),
): InvestmentPositionMetrics {
  const start = toUtcDay(input.startDate);
  const target = toUtcDay(input.targetDate);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const totalDays = Math.max(Math.round((target - start) / 86_400_000), 0);
  const daysElapsed = clamp(Math.round((today - start) / 86_400_000), 0, totalDays);
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);

  const gain = round(input.currentValue - input.principal, 2);
  const gainPercent = input.principal > 0 ? round((gain / input.principal) * 100, 2) : 0;

  return {
    principal: round(input.principal, 2),
    currentValue: round(input.currentValue, 2),
    gain,
    gainPercent,
    progressPercent: totalDays > 0 ? round((daysElapsed / totalDays) * 100, 2) : 100,
    daysElapsed,
    daysRemaining,
    totalDays,
    projectedValue: round(input.principal * (1 + input.targetReturnPct / 100), 2),
    isMatured: totalDays > 0 && daysRemaining === 0,
  };
}

/** Percentage of an investment product's capacity that has been allocated. */
export function capacityProgress(raised: number, capacity: number | null): number | null {
  if (!capacity || capacity <= 0) return null;
  return round(clamp((raised / capacity) * 100, 0, 100), 2);
}

export const RISK_LEVEL_LABELS = {
  conservative: "Conservative",
  moderate: "Moderate",
  balanced: "Balanced",
  growth: "Growth",
  aggressive: "Aggressive",
} as const;

/** 1–5 scale used by the risk meter component. */
export const RISK_LEVEL_SCORE = {
  conservative: 1,
  moderate: 2,
  balanced: 3,
  growth: 4,
  aggressive: 5,
} as const;
