import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LoginEvent, SupportMessage, SupportTicket, UserSettings } from "@/types/database";

export async function getMySettings(): Promise<UserSettings | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("user_settings").select("*").maybeSingle<UserSettings>();
  return data ?? null;
}

export async function listMyLoginEvents(limit = 25): Promise<LoginEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("login_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LoginEvent[]>();
  return data ?? [];
}

export interface TicketWithMessages extends SupportTicket {
  support_messages: SupportMessage[];
}

export async function listMyTickets(): Promise<SupportTicket[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SupportTicket[]>();
  return data ?? [];
}

export async function getMyTicket(id: string): Promise<TicketWithMessages | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("support_tickets")
    .select("*, support_messages(*)")
    .eq("id", id)
    .maybeSingle<TicketWithMessages>();
  if (!data) return null;

  data.support_messages = [...(data.support_messages ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return data;
}
