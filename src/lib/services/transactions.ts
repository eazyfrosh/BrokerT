import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionType, Wallet } from "@/types/database";

export async function listMyTransactions(
  options: { types?: TransactionType[]; limit?: number } = {},
): Promise<Transaction[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 250);

  if (options.types?.length) query = query.in("type", options.types);

  const { data } = await query.returns<Transaction[]>();
  return data ?? [];
}

export async function getMyWallet(): Promise<Wallet | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("wallets")
    .select("*")
    .eq("currency", "USD")
    .maybeSingle<Wallet>();
  return data ?? null;
}
