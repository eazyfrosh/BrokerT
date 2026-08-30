import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CarOrder, Vehicle, VehicleOption, VehicleOptionKind } from "@/types/database";

export interface VehicleWithOptions extends Vehicle {
  vehicle_options: VehicleOption[];
}

export interface CarOrderWithVehicle extends CarOrder {
  vehicles: Pick<Vehicle, "id" | "slug" | "model_name" | "image_url"> | null;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .order("display_order", { ascending: true })
    .returns<Vehicle[]>();
  return data ?? [];
}

export async function getVehicleBySlug(slug: string): Promise<VehicleWithOptions | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("vehicles")
    .select("*, vehicle_options(*)")
    .eq("slug", slug)
    .maybeSingle<VehicleWithOptions>();
  if (!data) return null;

  // Keep option order deterministic for the configurator.
  data.vehicle_options = [...(data.vehicle_options ?? [])].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
  );
  return data;
}

export function groupOptions(options: VehicleOption[]): Record<VehicleOptionKind, VehicleOption[]> {
  const groups: Record<VehicleOptionKind, VehicleOption[]> = {
    trim: [],
    exterior: [],
    interior: [],
    wheels: [],
    option: [],
  };
  for (const option of options) groups[option.kind].push(option);
  return groups;
}

export async function listMyCarOrders(): Promise<CarOrderWithVehicle[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("car_orders")
    .select("*, vehicles(id, slug, model_name, image_url)")
    .order("created_at", { ascending: false })
    .returns<CarOrderWithVehicle[]>();
  return data ?? [];
}

export async function getMyCarOrder(id: string): Promise<CarOrderWithVehicle | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("car_orders")
    .select("*, vehicles(id, slug, model_name, image_url)")
    .eq("id", id)
    .maybeSingle<CarOrderWithVehicle>();
  return data ?? null;
}
