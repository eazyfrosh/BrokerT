import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Investment, InvestmentPosition } from "@/types/database";

export interface InvestmentPositionWithProduct extends InvestmentPosition {
  investments: Pick<
    Investment,
    "id" | "slug" | "name" | "category" | "risk_level" | "duration_months" | "image_url"
  > | null;
}

/** Publicly listable strategies. */
export async function listOpenInvestments(limit?: number): Promise<Investment[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("investments")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (limit) query = query.limit(limit);

  const { data } = await query.returns<Investment[]>();
  return data ?? [];
}

/** Everything a signed-out visitor may browse: open, paused and closed. */
export async function listBrowsableInvestments(): Promise<Investment[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("investments")
    .select("*")
    .in("status", ["open", "paused", "closed"])
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Investment[]>();
  return data ?? [];
}

export async function getInvestmentBySlug(slug: string): Promise<Investment | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("investments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Investment>();
  return data ?? null;
}

/** The signed-in user's own allocations. RLS scopes this to them. */
export async function listMyInvestmentPositions(
  status?: InvestmentPosition["status"],
): Promise<InvestmentPositionWithProduct[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("investment_positions")
    .select("*, investments(id, slug, name, category, risk_level, duration_months, image_url)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data } = await query.returns<InvestmentPositionWithProduct[]>();
  return data ?? [];
}

export async function getMyInvestmentPosition(
  id: string,
): Promise<InvestmentPositionWithProduct | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("investment_positions")
    .select("*, investments(id, slug, name, category, risk_level, duration_months, image_url)")
    .eq("id", id)
    .maybeSingle<InvestmentPositionWithProduct>();
  return data ?? null;
}

/** Admin view — RLS lets admins read every product, including drafts. */
export async function listAllInvestments(): Promise<Investment[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("investments")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Investment[]>();
  return data ?? [];
}
