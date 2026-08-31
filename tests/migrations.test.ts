import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Static checks over the migration SQL.
 *
 * These exist because two bugs shipped that only a real Postgres would have
 * caught: `round(double precision, int)` (no such function) and guard triggers
 * that blocked the trusted server-side path. Both classes are cheap to detect
 * by inspection, so they are checked here as well as fixed.
 */
const DIR = "supabase/migrations";
const FILES = readdirSync(DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const ALL = FILES.map((name) => ({ name, sql: readFileSync(`${DIR}/${name}`, "utf8") }));

/** Functions that return double precision, which `round(x, n)` cannot take. */
const DOUBLE_SOURCES = /\b(random|sqrt|exp|ln|log|pow|power|sin|cos|atan2)\s*\(/;

describe("numeric rounding", () => {
  it("never calls the two-argument round() on a double-precision expression", () => {
    const offenders: string[] = [];

    for (const { name, sql } of ALL) {
      sql.split("\n").forEach((line, index) => {
        // Match round(<args>, <digits>) — the two-argument form, which
        // Postgres only defines for numeric.
        for (const match of line.matchAll(/round\((.+?),\s*\d+\s*\)/g)) {
          const args = match[1];
          if (!DOUBLE_SOURCES.test(args)) continue;
          // A cast to numeric anywhere in the expression makes it safe.
          if (/::\s*numeric/.test(args)) continue;
          offenders.push(`${name}:${index + 1}  ${line.trim()}`);
        }
      });
    }

    expect(offenders, `round(double precision, int) does not exist in Postgres:\n${offenders.join("\n")}`)
      .toEqual([]);
  });

  it("casts the candle generator's random walk before rounding", () => {
    const seed = ALL.find((file) => file.name.includes("seed_reference_data"))!.sql;
    expect(seed).toContain("(greatest(v_open, v_close) * (1 + random() * 0.018))::numeric");
    expect(seed).toContain("(least(v_open, v_close) * (1 - random() * 0.018))::numeric");
  });
});

describe("guard triggers", () => {
  const guards = ALL.find((file) => file.name.includes("guard_trusted_paths"))!.sql;

  it("lets a connection with no end user through every column guard", () => {
    for (const fn of [
      "guard_profile_self_update",
      "guard_car_order_user_update",
      "guard_notification_update",
    ]) {
      const body = guards.slice(guards.indexOf(`function public.${fn}()`)).slice(0, 1600);
      expect(body, `${fn} must exempt a null auth.uid()`).toMatch(/auth\.uid\(\) is null/);
    }
  });

  it("still blocks a signed-in customer from escalating their own account", () => {
    expect(guards).toContain("ROLE_CHANGE_FORBIDDEN");
    expect(guards).toContain("STATUS_CHANGE_FORBIDDEN");
    expect(guards).toContain("KYC_CHANGE_FORBIDDEN");
  });

  it("keeps the audit log immutable for every role, with no exemption", () => {
    const rls = ALL.find((file) => file.name.includes("rls"))!.sql;
    const guard = rls.slice(rls.indexOf("function public.guard_audit_log_immutable()")).slice(0, 400);
    expect(guard).toContain("AUDIT_LOG_IMMUTABLE");
    expect(guard).not.toMatch(/auth\.uid\(\) is null/);
    expect(guard).not.toMatch(/is_admin\(\)/);
  });
});

describe("migration hygiene", () => {
  it("numbers every migration uniquely and in order", () => {
    const numbers = FILES.map((name) => name.slice(0, 4));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect([...numbers]).toEqual([...numbers].sort());
  });

  it("is re-runnable: no bare CREATE TABLE or CREATE FUNCTION", () => {
    for (const { name, sql } of ALL) {
      const bareTable = /create table (?!if not exists)/i.test(sql);
      const bareFunction = /create function /i.test(sql);
      expect(bareTable, `${name} has a CREATE TABLE without IF NOT EXISTS`).toBe(false);
      expect(bareFunction, `${name} has a CREATE FUNCTION without OR REPLACE`).toBe(false);
    }
  });

  it("drops each policy before recreating it", () => {
    for (const { name, sql } of ALL) {
      const created = [...sql.matchAll(/create policy (\w+)/g)].map((m) => m[1]);
      const dropped = new Set([...sql.matchAll(/drop policy if exists (\w+)/g)].map((m) => m[1]));
      for (const policy of created) {
        expect(dropped.has(policy), `${name}: policy ${policy} is created but never dropped first`).toBe(
          true,
        );
      }
    }
  });
});
