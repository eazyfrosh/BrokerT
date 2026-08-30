import { round } from "@/lib/utils";

/** Deterministic 32-bit hash, so a given seed always produces the same series. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulatedPoint {
  date: string;
  value: number;
}

/** Annualised volatility implied by a strategy's stated risk level. */
const RISK_VOLATILITY: Record<string, number> = {
  conservative: 0.04,
  moderate: 0.08,
  balanced: 0.12,
  growth: 0.2,
  aggressive: 0.34,
};

/**
 * Builds an illustrative, simulated track record for a strategy.
 *
 * This is explicitly not real performance data — it exists so the product can
 * demonstrate the shape of a strategy without fabricating a claim about any
 * real-world result. Every surface that renders it labels it as simulated.
 */
export function simulateStrategyHistory(options: {
  seed: string;
  months: number;
  annualReturnPct: number;
  riskLevel: string;
  startValue?: number;
}): SimulatedPoint[] {
  const { seed, months, annualReturnPct, riskLevel, startValue = 100 } = options;
  const random = mulberry32(hashSeed(seed));
  const volatility = RISK_VOLATILITY[riskLevel] ?? 0.12;

  const monthlyDrift = Math.log(1 + annualReturnPct / 100) / 12;
  const monthlyVol = volatility / Math.sqrt(12);

  const points: SimulatedPoint[] = [];
  const now = new Date();
  let value = startValue;

  for (let i = months; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));

    if (i < months) {
      // Box–Muller shock, so the walk has a realistic distribution.
      const u1 = random() || Number.EPSILON;
      const u2 = random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      value *= Math.exp(monthlyDrift - 0.5 * monthlyVol * monthlyVol + monthlyVol * z);
    }

    points.push({ date: date.toISOString().slice(0, 10), value: round(value, 2) });
  }

  return points;
}
