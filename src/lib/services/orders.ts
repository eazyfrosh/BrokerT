import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Order, OrderFill, OrderStatus } from "@/types/database";

export interface OrderWithAsset extends Order {
  assets: { symbol: string; name: string; currency: string } | null;
}

export async function listMyOrders(options: { status?: OrderStatus; limit?: number } = {}): Promise<OrderWithAsset[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("orders")
    .select("*, assets(symbol, name, currency)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status) query = query.eq("status", options.status);

  const { data } = await query.returns<OrderWithAsset[]>();
  return data ?? [];
}

export async function getMyOrder(id: string): Promise<{ order: OrderWithAsset; fills: OrderFill[] } | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("*, assets(symbol, name, currency)")
    .eq("id", id)
    .maybeSingle<OrderWithAsset>();

  if (!order) return null;

  const { data: fills } = await supabase
    .from("order_fills")
    .select("*")
    .eq("order_id", id)
    .order("filled_at", { ascending: true })
    .returns<OrderFill[]>();

  return { order, fills: fills ?? [] };
}

/** Statuses a user is allowed to cancel from. */
export function isCancellable(status: OrderStatus): boolean {
  return status === "pending" || status === "submitted" || status === "partially_filled";
}
