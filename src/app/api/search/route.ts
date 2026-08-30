import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext, isAdminRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface SearchResult {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Escapes the wildcard characters PostgREST's `ilike` filter would interpret. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\,()]/g, "");
}

/**
 * Global search across the caller's own records plus public catalogue data.
 * RLS scopes every query, so a non-admin cannot reach another user's rows even
 * if the query below were wrong.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (raw.length < 2) return NextResponse.json({ results: [] });

  const session = await getSessionContext();
  if (!session) return NextResponse.json({ results: [] }, { status: 401 });

  const term = escapeLike(raw).slice(0, 60);
  if (!term) return NextResponse.json({ results: [] });

  const pattern = `%${term}%`;
  const { supabase, profile } = session;
  const admin = isAdminRole(profile.role);

  const [assets, orders, investments, vehicles, users] = await Promise.all([
    supabase.from("assets").select("id, symbol, name").or(`symbol.ilike.${pattern},name.ilike.${pattern}`).limit(3),
    supabase
      .from("orders")
      .select("id, reference, side, quantity, status, assets(symbol)")
      .ilike("reference", pattern)
      .limit(5),
    supabase
      .from("investments")
      .select("id, slug, name, category")
      .or(`name.ilike.${pattern},category.ilike.${pattern}`)
      .in("status", ["open", "paused", "closed"])
      .limit(5),
    supabase
      .from("vehicles")
      .select("id, slug, model_name, tagline")
      .ilike("model_name", pattern)
      .limit(5),
    admin
      ? supabase.from("profiles").select("id, email, first_name, last_name").ilike("email", pattern).limit(5)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const results: SearchResult[] = [];

  for (const asset of assets.data ?? []) {
    results.push({
      id: `asset-${asset.id}`,
      group: "Markets",
      title: `${asset.symbol} · ${asset.name}`,
      subtitle: "Open the market terminal",
      href: `/markets`,
    });
  }

  for (const order of (orders.data ?? []) as unknown as Array<{
    id: string;
    reference: string;
    side: string;
    quantity: number;
    status: string;
    assets: { symbol: string } | null;
  }>) {
    results.push({
      id: `order-${order.id}`,
      group: "Orders",
      title: order.reference,
      subtitle: `${order.side} ${order.quantity} ${order.assets?.symbol ?? ""} · ${order.status.replace(/_/g, " ")}`,
      href: `/orders/${order.id}`,
    });
  }

  for (const investment of investments.data ?? []) {
    results.push({
      id: `investment-${investment.id}`,
      group: "Strategies",
      title: investment.name,
      subtitle: investment.category,
      href: `/investments/${investment.slug}`,
    });
  }

  for (const vehicle of vehicles.data ?? []) {
    results.push({
      id: `vehicle-${vehicle.id}`,
      group: "Vehicles",
      title: vehicle.model_name,
      subtitle: vehicle.tagline ?? undefined,
      href: `/cars/${vehicle.slug}`,
    });
  }

  if (admin) {
    for (const user of (users.data ?? []) as unknown as Array<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      results.push({
        id: `user-${user.id}`,
        group: "Users",
        title: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
        subtitle: user.email,
        href: `/admin/users/${user.id}`,
      });
    }
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
