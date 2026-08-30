import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AuditLog,
  CarOrder,
  Profile,
  SupportMessage,
  SupportTicket,
  Transaction,
  Vehicle,
} from "@/types/database";
import type { OrderWithAsset } from "./orders";

/**
 * Admin reads go through the caller's own RLS-scoped client, not the service
 * role: `public.is_admin()` widens the SELECT policies, so an admin sees the
 * whole table while a customer still cannot. Nothing here escalates.
 */

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  newUsers30d: number;
  newUsers7d: number;
  totalOrders: number;
  pendingOrders: number;
  filledOrders: number;
  carOrders: number;
  openCarOrders: number;
  openTickets: number;
  pendingKyc: number;
  simulatedHoldingsValue: number;
  simulatedCashBalance: number;
  simulatedInvestedValue: number;
  simulatedFees: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const now = Date.now();
  const since30 = new Date(now - 30 * 86_400_000).toISOString();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();

  const head = { count: "exact" as const, head: true };

  const [
    users,
    activeUsers,
    suspendedUsers,
    new30,
    new7,
    orders,
    pendingOrders,
    filledOrders,
    carOrders,
    openCarOrders,
    openTickets,
    pendingKyc,
    holdings,
    wallets,
    positions,
    fees,
  ] = await Promise.all([
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).eq("account_status", "active"),
    supabase.from("profiles").select("id", head).eq("account_status", "suspended"),
    supabase.from("profiles").select("id", head).gte("created_at", since30),
    supabase.from("profiles").select("id", head).gte("created_at", since7),
    supabase.from("orders").select("id", head),
    supabase.from("orders").select("id", head).in("status", ["pending", "submitted", "partially_filled"]),
    supabase.from("orders").select("id", head).eq("status", "filled"),
    supabase.from("car_orders").select("id", head),
    supabase
      .from("car_orders")
      .select("id", head)
      .not("status", "in", "(completed,cancelled)"),
    supabase.from("support_tickets").select("id", head).in("status", ["open", "pending"]),
    supabase.from("profiles").select("id", head).eq("kyc_status", "pending"),
    supabase
      .from("portfolio_holdings")
      .select("quantity, assets(market_quotes(price))")
      .gt("quantity", 0),
    supabase.from("wallets").select("available_balance, reserved_balance"),
    supabase.from("investment_positions").select("current_value").eq("status", "active"),
    supabase.from("transactions").select("amount").eq("type", "fee"),
  ]);

  const holdingRows = (holdings.data ?? []) as unknown as {
    quantity: number;
    assets: { market_quotes: { price: number } | null } | null;
  }[];

  return {
    totalUsers: users.count ?? 0,
    activeUsers: activeUsers.count ?? 0,
    suspendedUsers: suspendedUsers.count ?? 0,
    newUsers30d: new30.count ?? 0,
    newUsers7d: new7.count ?? 0,
    totalOrders: orders.count ?? 0,
    pendingOrders: pendingOrders.count ?? 0,
    filledOrders: filledOrders.count ?? 0,
    carOrders: carOrders.count ?? 0,
    openCarOrders: openCarOrders.count ?? 0,
    openTickets: openTickets.count ?? 0,
    pendingKyc: pendingKyc.count ?? 0,
    simulatedHoldingsValue: holdingRows.reduce(
      (sum, row) => sum + Number(row.quantity) * Number(row.assets?.market_quotes?.price ?? 0),
      0,
    ),
    simulatedCashBalance: (wallets.data ?? []).reduce(
      (sum, wallet) => sum + Number(wallet.available_balance) + Number(wallet.reserved_balance),
      0,
    ),
    simulatedInvestedValue: (positions.data ?? []).reduce(
      (sum, position) => sum + Number(position.current_value),
      0,
    ),
    simulatedFees: (fees.data ?? []).reduce((sum, fee) => sum + Math.abs(Number(fee.amount)), 0),
  };
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/** Daily counts for the last `days` days, zero-filled so the chart has no gaps. */
export async function getDailyCounts(
  table: "profiles" | "orders" | "investment_positions" | "car_orders",
  days = 30,
): Promise<TimeSeriesPoint[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const since = new Date(Date.now() - days * 86_400_000);
  const { data } = await supabase
    .from(table)
    .select("created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  const buckets = new Map<string, number>();
  for (let i = days; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(day, 0);
  }
  for (const row of data ?? []) {
    const day = String(row.created_at).slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

export async function listAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Profile[]>();
  return data ?? [];
}

export interface AdminUserDetail {
  profile: Profile;
  wallet: { available_balance: number; reserved_balance: number; pending_balance: number } | null;
  orders: OrderWithAsset[];
  transactions: Transaction[];
  carOrders: (CarOrder & { vehicles: Pick<Vehicle, "model_name"> | null })[];
  loginEvents: { id: string; event: string; created_at: string; ip_address: string | null; user_agent: string | null; succeeded: boolean }[];
  holdings: { quantity: number; average_cost: number; assets: { symbol: string; market_quotes: { price: number } | null } | null }[];
  positions: { id: string; reference: string; principal: number; current_value: number; status: string; investments: { name: string } | null }[];
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (!profile) return null;

  const [wallet, orders, transactions, carOrders, loginEvents, holdings, positions] = await Promise.all([
    supabase
      .from("wallets")
      .select("available_balance, reserved_balance, pending_balance")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("*, assets(symbol, name, currency)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("car_orders")
      .select("*, vehicles(model_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("login_events")
      .select("id, event, created_at, ip_address, user_agent, succeeded")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("portfolio_holdings")
      .select("quantity, average_cost, assets(symbol, market_quotes(price))")
      .eq("user_id", userId)
      .gt("quantity", 0),
    supabase
      .from("investment_positions")
      .select("id, reference, principal, current_value, status, investments(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    profile,
    wallet: (wallet.data as AdminUserDetail["wallet"]) ?? null,
    orders: (orders.data ?? []) as unknown as OrderWithAsset[],
    transactions: (transactions.data ?? []) as Transaction[],
    carOrders: (carOrders.data ?? []) as unknown as AdminUserDetail["carOrders"],
    loginEvents: (loginEvents.data ?? []) as AdminUserDetail["loginEvents"],
    holdings: (holdings.data ?? []) as unknown as AdminUserDetail["holdings"],
    positions: (positions.data ?? []) as unknown as AdminUserDetail["positions"],
  };
}

export interface AdminOrderRow extends OrderWithAsset {
  profiles: Pick<Profile, "id" | "email" | "first_name" | "last_name"> | null;
}

export async function listAllOrders(): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("orders")
    .select("*, assets(symbol, name, currency), profiles(id, email, first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<AdminOrderRow[]>();
  return data ?? [];
}

export interface AdminTransactionRow extends Transaction {
  profiles: Pick<Profile, "id" | "email"> | null;
}

export async function listAllTransactions(types?: Transaction["type"][]): Promise<AdminTransactionRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("transactions")
    .select("*, profiles(id, email)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (types?.length) query = query.in("type", types);

  const { data } = await query.returns<AdminTransactionRow[]>();
  return data ?? [];
}

export interface AdminCarOrderRow extends CarOrder {
  vehicles: Pick<Vehicle, "id" | "slug" | "model_name"> | null;
  profiles: Pick<Profile, "id" | "email"> | null;
}

export async function listAllCarOrders(): Promise<AdminCarOrderRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("car_orders")
    .select("*, vehicles(id, slug, model_name), profiles(id, email)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<AdminCarOrderRow[]>();
  return data ?? [];
}

export async function listAuditLogs(limit = 300): Promise<AuditLog[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditLog[]>();
  return data ?? [];
}

export interface AdminTicketRow extends SupportTicket {
  profiles: Pick<Profile, "id" | "email"> | null;
}

export async function listAllTickets(): Promise<AdminTicketRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("support_tickets")
    .select("*, profiles(id, email)")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<AdminTicketRow[]>();
  return data ?? [];
}

export async function getAdminTicket(
  id: string,
): Promise<(AdminTicketRow & { support_messages: SupportMessage[] }) | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("support_tickets")
    .select("*, profiles(id, email), support_messages(*)")
    .eq("id", id)
    .maybeSingle<AdminTicketRow & { support_messages: SupportMessage[] }>();
  if (!data) return null;

  data.support_messages = [...(data.support_messages ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return data;
}
