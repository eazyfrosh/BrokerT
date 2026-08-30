/**
 * Central runtime configuration.
 *
 * Nothing here throws at import time — the app must still render (with a clear
 * setup screen) when environment variables have not been provided yet.
 */

function readPublic(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Demo mode defaults to ON so a fresh clone never implies real money movement. */
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
} as const;

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export const DEMO_MODE = publicEnv.demoMode;

export const APP = {
  name: "BrokerT",
  legalName: "BrokerT Technologies",
  tagline: "Invest in Tesla. Built for modern investors.",
  description:
    "BrokerT is an independent, Tesla-focused investment and trading platform. Monitor TSLA market data, manage a portfolio, place demo orders and explore investment opportunities.",
  supportEmail: "support@brokert.example",
  /** Shown in every footer — the platform is not affiliated with Tesla, Inc. */
  trademarkNotice:
    "BrokerT is an independent platform and is not affiliated with, endorsed by, sponsored by, or operated by Tesla, Inc. “Tesla”, “Model 3”, “Model Y”, “Model S”, “Model X” and “Cybertruck” are trademarks of Tesla, Inc., used here only for nominative reference.",
  riskNotice:
    "Investing involves risk, including the possible loss of principal. Past performance does not guarantee future results.",
  demoNotice:
    "Demo mode is active. Prices, balances, orders and vehicle order requests are simulated and do not represent real market data or real money movement.",
} as const;

/** Server-only secrets. Never import this module from a Client Component. */
export function serverEnv() {
  return {
    supabaseUrl: readPublic("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readPublic("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: readPublic("SUPABASE_SERVICE_ROLE_KEY"),
    resendApiKey: readPublic("RESEND_API_KEY"),
    emailFrom: readPublic("EMAIL_FROM") ?? "BrokerT <no-reply@brokert.example>",
    marketDataProvider: readPublic("MARKET_DATA_PROVIDER") ?? "simulated",
    marketDataApiKey: readPublic("MARKET_DATA_API_KEY"),
    adminEmail: readPublic("ADMIN_EMAIL"),
    adminSetupSecret: readPublic("ADMIN_SETUP_SECRET"),
  } as const;
}

/** Trading parameters — a single source of truth for every calculation. */
export const TRADING = {
  /** Commission charged per order, expressed as a fraction of notional. */
  commissionRate: 0,
  /** Flat per-order fee, in account currency. */
  flatFee: 0,
  /** Regulatory-style fee applied to sells only (illustrative, demo). */
  sellFeeRate: 0.0000278,
  minimumOrderQuantity: 0.000001,
  maximumOrderNotional: 5_000_000,
  baseCurrency: "USD",
} as const;

export const PRIMARY_SYMBOL = "TSLA";
