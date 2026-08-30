import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";

/**
 * Authorisation lives in SQL, so these tests assert against the migrations
 * themselves. They verify that the guarantees the application relies on are
 * actually declared — they do not replace running the policies against a live
 * database, which requires a Postgres instance.
 */
const RLS_SQL = readFileSync("supabase/migrations/0003_rls.sql", "utf8");
const FUNCTIONS_SQL = readFileSync("supabase/migrations/0002_functions.sql", "utf8");
const SCHEMA_SQL = readFileSync("supabase/migrations/0001_schema.sql", "utf8");
const RESTING_SQL = readFileSync("supabase/migrations/0005_resting_orders.sql", "utf8");

const USER_SCOPED_TABLES = [
  "profiles",
  "user_settings",
  "wallets",
  "portfolios",
  "portfolio_holdings",
  "portfolio_snapshots",
  "orders",
  "order_fills",
  "investment_positions",
  "car_orders",
  "transactions",
  "watchlists",
  "watchlist_items",
  "notifications",
  "support_tickets",
  "login_events",
];

const REFERENCE_TABLES = ["assets", "market_quotes", "market_candles", "vehicles", "vehicle_options"];

describe("isAdminRole", () => {
  it("treats admin and super_admin as administrative", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("does not treat an ordinary user as administrative", () => {
    expect(isAdminRole("user")).toBe(false);
  });

  it("reserves super-admin powers to super_admin alone", () => {
    expect(isSuperAdminRole("super_admin")).toBe(true);
    expect(isSuperAdminRole("admin")).toBe(false);
    expect(isSuperAdminRole("user")).toBe(false);
  });
});

describe("row level security", () => {
  it("enables RLS on every user-scoped table", () => {
    for (const table of USER_SCOPED_TABLES) {
      expect(RLS_SQL).toContain(`alter table public.${table}`);
      expect(
        new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(RLS_SQL),
      ).toBe(true);
    }
  });

  it("enables RLS on reference tables too, rather than leaving them open", () => {
    for (const table of REFERENCE_TABLES) {
      expect(
        new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(RLS_SQL),
      ).toBe(true);
    }
  });

  it("forces RLS on the tables that carry money and identity", () => {
    for (const table of ["profiles", "wallets", "orders", "transactions", "audit_logs"]) {
      expect(
        new RegExp(`alter table public\\.${table}\\s+force row level security`).test(RLS_SQL),
      ).toBe(true);
    }
  });

  it("scopes every user-facing select policy to auth.uid()", () => {
    for (const table of ["orders", "transactions", "portfolio_holdings", "investment_positions", "car_orders"]) {
      const policy = new RegExp(
        `create policy ${table}_select on public\\.${table}[\\s\\S]*?using \\(user_id = auth\\.uid\\(\\) or public\\.is_admin\\(\\)\\)`,
      );
      expect(policy.test(RLS_SQL)).toBe(true);
    }
  });

  it("grants no INSERT or UPDATE policy on wallets, so balances move only through RPCs", () => {
    expect(RLS_SQL).toContain("create policy wallets_select on public.wallets");
    expect(/create policy [\w]+ on public\.wallets\s+for (insert|update|all)/.test(RLS_SQL)).toBe(false);
  });

  it("grants no INSERT or UPDATE policy on orders or transactions", () => {
    expect(/create policy [\w]+ on public\.orders\s+for (insert|update|all)/.test(RLS_SQL)).toBe(false);
    expect(/create policy [\w]+ on public\.transactions\s+for (insert|update|all)/.test(RLS_SQL)).toBe(
      false,
    );
  });

  it("restricts audit log reads to admins and blocks every write", () => {
    expect(RLS_SQL).toContain("create policy audit_logs_select_admin");
    expect(RLS_SQL).toContain("using (public.is_admin())");
    expect(RLS_SQL).toContain("create trigger audit_logs_no_update before update or delete");
    expect(RLS_SQL).toContain("AUDIT_LOG_IMMUTABLE");
  });

  it("blocks a user from escalating their own role, status or verification", () => {
    expect(RLS_SQL).toContain("ROLE_CHANGE_FORBIDDEN");
    expect(RLS_SQL).toContain("STATUS_CHANGE_FORBIDDEN");
    expect(RLS_SQL).toContain("KYC_CHANGE_FORBIDDEN");
    expect(RLS_SQL).toContain("create trigger profiles_guard_self_update");
  });

  it("hides internal notes on a vehicle order from the customer", () => {
    expect(RLS_SQL).toContain("guard_car_order_user_update");
    expect(RLS_SQL).toContain("new.internal_notes is distinct from old.internal_notes");
  });

  it("lets a user flip read_at but not rewrite a notification", () => {
    expect(RLS_SQL).toContain("guard_notification_update");
    expect(RLS_SQL).toContain("new.message is distinct from old.message");
  });
});

describe("role helpers", () => {
  it("defines the admin helpers as SECURITY DEFINER so policies do not recurse", () => {
    for (const fn of ["is_admin", "is_super_admin", "current_user_role"]) {
      const declaration = new RegExp(
        `create or replace function public\\.${fn}\\(\\)[\\s\\S]*?security definer`,
      );
      expect(declaration.test(SCHEMA_SQL)).toBe(true);
    }
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const definers = FUNCTIONS_SQL.match(/security definer/g) ?? [];
    const pinned = FUNCTIONS_SQL.match(/security definer\s+set search_path = public/g) ?? [];
    expect(definers.length).toBeGreaterThan(0);
    expect(pinned.length).toBe(definers.length);
  });
});

describe("money-moving functions", () => {
  it("resolves the fill price from the stored quote, not from the caller", () => {
    expect(FUNCTIONS_SQL).toContain("v_price := v_quote.price");
    expect(FUNCTIONS_SQL).toContain("QUOTE_UNAVAILABLE");
  });

  it("locks the wallet row before checking buying power", () => {
    expect(FUNCTIONS_SQL).toMatch(/select \* into v_wallet from public\.wallets[\s\S]*?for update/);
  });

  it("rejects a buy without sufficient funds and a sell without the position", () => {
    expect(FUNCTIONS_SQL).toContain("INSUFFICIENT_FUNDS");
    expect(FUNCTIONS_SQL).toContain("INSUFFICIENT_POSITION");
  });

  it("refuses to trade for an account that is not active", () => {
    expect(FUNCTIONS_SQL).toContain("ACCOUNT_NOT_ACTIVE");
  });

  it("re-checks the strategy minimum, maximum and capacity server-side", () => {
    expect(FUNCTIONS_SQL).toContain("BELOW_MINIMUM");
    expect(FUNCTIONS_SQL).toContain("ABOVE_MAXIMUM");
    expect(FUNCTIONS_SQL).toContain("CAPACITY_EXCEEDED");
  });

  it("disables simulated cash movement when demo mode is off", () => {
    expect(FUNCTIONS_SQL).toContain("DEMO_MODE_DISABLED");
    expect(FUNCTIONS_SQL).toMatch(/from public\.system_settings where key = 'demo_mode'/);
  });
});

describe("admin functions", () => {
  it("checks is_admin() inside every admin routine", () => {
    for (const fn of [
      "admin_update_user_status",
      "admin_update_order_status",
      "admin_update_car_order",
      "admin_broadcast_notification",
      "admin_log",
    ]) {
      const body = FUNCTIONS_SQL.slice(
        FUNCTIONS_SQL.indexOf(`create or replace function public.${fn}(`),
      ).slice(0, 2500);
      expect(body).toContain("public.is_admin()");
      expect(body).toContain("FORBIDDEN");
    }
  });

  it("restricts role changes to super admins", () => {
    const body = FUNCTIONS_SQL.slice(
      FUNCTIONS_SQL.indexOf("create or replace function public.admin_update_user_role("),
    ).slice(0, 1500);
    expect(body).toContain("public.is_super_admin()");
  });

  it("stops an admin from changing their own status or role", () => {
    expect(FUNCTIONS_SQL).toContain("CANNOT_MODIFY_SELF");
  });

  it("audits status, role, order and vehicle changes", () => {
    for (const action of [
      "user.status_changed",
      "user.role_changed",
      "order.status_changed",
      "car_order.updated",
      "notification.broadcast",
    ]) {
      expect(FUNCTIONS_SQL).toContain(action);
    }
  });
});

describe("resting order settlement", () => {
  it("only considers orders that are still working", () => {
    expect(RESTING_SQL).toContain("where status in ('submitted', 'partially_filled')");
  });

  it("takes a row lock and skips rows another worker holds", () => {
    expect(RESTING_SQL).toContain("for update skip locked");
  });

  it("caps the fill at the customer's limit so they never do worse", () => {
    expect(RESTING_SQL).toContain("v_price := least(v_quote.price, v_order.limit_price)");
    expect(RESTING_SQL).toContain("v_price := greatest(v_quote.price, v_order.limit_price)");
  });

  it("releases the reservation rather than double-spending the balance", () => {
    expect(RESTING_SQL).toContain("reserved_balance = reserved_balance - v_reserved");
    expect(RESTING_SQL).toContain("least(v_reserved, v_wallet.reserved_balance)");
  });

  it("rejects a sell whose position has since gone, instead of going negative", () => {
    expect(RESTING_SQL).toContain("Position no longer sufficient to fill this order");
  });

  it("is not callable by a browser session", () => {
    expect(RESTING_SQL).toContain("revoke all on function public.process_resting_orders(uuid) from public");
    expect(RESTING_SQL).not.toMatch(/grant execute on function public\.process_resting_orders[\s\S]*?to authenticated/);
  });

  it("writes a ledger entry and a notification for every fill", () => {
    expect(RESTING_SQL).toContain("insert into public.transactions");
    expect(RESTING_SQL).toContain("'order_filled'");
  });
});

describe("execute grants", () => {
  it("revokes public execute and grants only to authenticated", () => {
    for (const fn of ["place_order", "cancel_order", "create_investment_position", "demo_cash_movement"]) {
      expect(FUNCTIONS_SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`));
      expect(FUNCTIONS_SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]*?to authenticated`));
    }
  });
});
