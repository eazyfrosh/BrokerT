#!/usr/bin/env node
/**
 * Create fictional demo accounts with activity, so a fresh deployment has
 * something to look at.
 *
 * Usage:  npm run seed:demo
 *         npm run seed:demo -- --reset     (remove previously seeded accounts first)
 *
 * Everything created here is clearly fictional: the addresses are all on
 * @demo.brokert.example, which is not a deliverable domain, and every record is
 * marked is_simulated. No real person's data is used or invented.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security — this
 * is a local/administrative tool and must never run in a request path.
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** A non-deliverable domain, so a seeded address can never reach a real inbox. */
const DEMO_DOMAIN = "demo.brokert.example";
const DEMO_PASSWORD = "Demo-Account-2026!";

const PEOPLE = [
  { first: "Ada", last: "Ellery", country: "United Kingdom", cash: 42_500, shares: 120, avgCost: 208.4 },
  { first: "Bruno", last: "Castellan", country: "Portugal", cash: 8_200, shares: 35, avgCost: 241.15 },
  { first: "Chidi", last: "Okonjo", country: "Nigeria", cash: 61_000, shares: 250, avgCost: 189.7 },
  { first: "Dana", last: "Kirsch", country: "Germany", cash: 3_400, shares: 12, avgCost: 262.05 },
  { first: "Emi", last: "Watanabe", country: "Japan", cash: 27_900, shares: 88, avgCost: 221.6 },
  { first: "Farid", last: "Nasser", country: "United Arab Emirates", cash: 15_600, shares: 0, avgCost: 0 },
];

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function reference(prefix) {
  let body = "";
  for (let i = 0; i < 8; i++) body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}-${body}`;
}

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

async function reset() {
  console.log("Removing previously seeded demo accounts…");
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const seeded = (users?.users ?? []).filter((user) => user.email?.endsWith(`@${DEMO_DOMAIN}`));
  for (const user of seeded) {
    await supabase.auth.admin.deleteUser(user.id);
  }
  console.log(`  removed ${seeded.length} account(s)`);
}

async function main() {
  if (process.argv.includes("--reset")) await reset();

  const { data: asset } = await supabase
    .from("assets")
    .select("id, symbol")
    .eq("symbol", "TSLA")
    .maybeSingle();

  if (!asset) {
    console.error("No TSLA asset found. Run the migrations in supabase/migrations first.");
    process.exit(1);
  }

  const { data: quote } = await supabase
    .from("market_quotes")
    .select("price")
    .eq("asset_id", asset.id)
    .maybeSingle();
  const price = Number(quote?.price ?? 250);

  const { data: investments } = await supabase
    .from("investments")
    .select("id, name, target_return_pct, duration_months")
    .eq("status", "open")
    .limit(3);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, model_name, base_price")
    .order("display_order")
    .limit(3);

  let created = 0;

  for (const [index, person] of PEOPLE.entries()) {
    const email = `${person.first}.${person.last}`.toLowerCase() + `@${DEMO_DOMAIN}`;

    const { data: signUp, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: person.first,
        last_name: person.last,
        country: person.country,
        phone: `+1 555 01${String(index).padStart(2, "0")} 000`,
      },
    });

    if (signUpError) {
      if (signUpError.message?.includes("already been registered")) {
        console.log(`  ${email} already exists — skipping`);
        continue;
      }
      console.error(`  could not create ${email}: ${signUpError.message}`);
      continue;
    }

    const userId = signUp.user.id;

    // The handle_new_user() trigger has already provisioned the profile,
    // wallet, portfolio, watchlist and welcome notification.
    await supabase
      .from("wallets")
      .update({ available_balance: person.cash })
      .eq("user_id", userId);

    await supabase.from("transactions").insert({
      reference: reference("TXN"),
      user_id: userId,
      type: "deposit",
      status: "completed",
      amount: person.cash,
      balance_after: person.cash,
      description: "Simulated demo funding — no real money was received",
      payment_method: "demo",
      is_simulated: true,
      processed_at: daysAgo(30),
      created_at: daysAgo(30),
    });

    if (person.shares > 0) {
      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      await supabase.from("portfolio_holdings").insert({
        portfolio_id: portfolio.id,
        user_id: userId,
        asset_id: asset.id,
        quantity: person.shares,
        average_cost: person.avgCost,
      });

      const notional = round(person.shares * person.avgCost);
      const orderReference = reference("ORD");

      const { data: order } = await supabase
        .from("orders")
        .insert({
          reference: orderReference,
          user_id: userId,
          asset_id: asset.id,
          side: "buy",
          order_type: "market",
          quantity: person.shares,
          filled_quantity: person.shares,
          estimated_price: person.avgCost,
          average_fill_price: person.avgCost,
          status: "filled",
          is_simulated: true,
          submitted_at: daysAgo(25),
          filled_at: daysAgo(25),
          created_at: daysAgo(25),
        })
        .select("id")
        .single();

      await supabase.from("order_fills").insert({
        order_id: order.id,
        user_id: userId,
        quantity: person.shares,
        price: person.avgCost,
        filled_at: daysAgo(25),
      });

      await supabase.from("transactions").insert({
        reference: reference("TXN"),
        user_id: userId,
        type: "buy",
        status: "completed",
        amount: -notional,
        balance_after: round(person.cash - notional),
        description: `Buy ${person.shares} TSLA @ ${person.avgCost.toFixed(2)}`,
        related_order_id: order.id,
        is_simulated: true,
        processed_at: daysAgo(25),
        created_at: daysAgo(25),
      });

      // A resting limit order, so the orders screen shows a working state.
      if (index % 2 === 0) {
        await supabase.from("orders").insert({
          reference: reference("ORD"),
          user_id: userId,
          asset_id: asset.id,
          side: "sell",
          order_type: "limit",
          quantity: Math.max(Math.round(person.shares / 4), 1),
          limit_price: round(price * 1.12),
          estimated_price: price,
          status: "submitted",
          time_in_force: "gtc",
          is_simulated: true,
          submitted_at: daysAgo(3),
          created_at: daysAgo(3),
        });
      }
    }

    // An investment allocation for some accounts.
    const investment = investments?.[index % (investments?.length || 1)];
    if (investment && index % 2 === 0) {
      const principal = 2_500 + index * 750;
      const start = new Date(Date.now() - 60 * 86_400_000);
      const target = new Date(start);
      target.setMonth(target.getMonth() + investment.duration_months);

      const { data: position } = await supabase
        .from("investment_positions")
        .insert({
          reference: reference("INV"),
          user_id: userId,
          investment_id: investment.id,
          principal,
          current_value: round(principal * (1 + (Math.random() * 0.09 - 0.02))),
          target_return_pct: investment.target_return_pct,
          start_date: start.toISOString().slice(0, 10),
          target_date: target.toISOString().slice(0, 10),
          status: "active",
          is_simulated: true,
          created_at: start.toISOString(),
        })
        .select("id")
        .single();

      await supabase.from("transactions").insert({
        reference: reference("TXN"),
        user_id: userId,
        type: "investment",
        status: "completed",
        amount: -principal,
        balance_after: round(person.cash - principal),
        description: `Allocation to ${investment.name}`,
        related_investment_position_id: position.id,
        is_simulated: true,
        processed_at: start.toISOString(),
        created_at: start.toISOString(),
      });

      await supabase
        .from("investments")
        .update({ raised_amount: principal })
        .eq("id", investment.id);
    }

    // A vehicle order request for a couple of accounts.
    const vehicle = vehicles?.[index % (vehicles?.length || 1)];
    if (vehicle && index % 3 === 0) {
      await supabase.from("car_orders").insert({
        reference: reference("CAR"),
        user_id: userId,
        vehicle_id: vehicle.id,
        configuration: {
          trim: "long-range",
          exterior: "pearl-white",
          interior: "all-black",
          wheels: "aero-18",
          options: ["home-charger"],
        },
        configuration_summary: "Long Range · Pearl White · All Black · 18\" Aero · Home Wall Charger",
        total_price: round(Number(vehicle.base_price) + 9_550),
        status: index === 0 ? "confirmed" : "processing",
        delivery_full_name: `${person.first} ${person.last}`,
        delivery_email: email,
        delivery_country: person.country,
        delivery_city: "Demo City",
        delivery_address_line1: "1 Simulation Way",
        delivery_region: "Demo Region",
        delivery_postal_code: "00000",
        estimated_delivery: new Date(Date.now() + 75 * 86_400_000).toISOString().slice(0, 10),
        is_simulated: true,
        created_at: daysAgo(12),
      });
    }

    // A short value history so the portfolio chart has something to draw.
    const snapshots = [];
    for (let day = 30; day >= 0; day--) {
      const drift = 1 + (30 - day) * 0.0016 + (Math.random() - 0.5) * 0.012;
      const holdingsValue = person.shares * person.avgCost * drift;
      snapshots.push({
        user_id: userId,
        captured_on: new Date(Date.now() - day * 86_400_000).toISOString().slice(0, 10),
        total_value: round(holdingsValue + person.cash),
        holdings_value: round(holdingsValue),
        cash_balance: person.cash,
        invested_value: 0,
      });
    }
    await supabase.from("portfolio_snapshots").upsert(snapshots, { onConflict: "user_id,captured_on" });

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "portfolio_alert",
      title: "Your demo portfolio is ready",
      message:
        "This account was created by the demo seed script. Every balance, holding and order on it is simulated.",
      link: "/portfolio",
    });

    created += 1;
    console.log(`  created ${email}`);
  }

  console.log(`\nSeeded ${created} demo account(s).`);
  if (created > 0) {
    console.log(`Sign in with any of the addresses above and the password: ${DEMO_PASSWORD}`);
    console.log("These are fictional accounts on a non-deliverable domain. Do not use them in production.");
  }
}

await main();
