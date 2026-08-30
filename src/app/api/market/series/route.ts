import { NextResponse, type NextRequest } from "next/server";
import { getSeries } from "@/lib/services/market";
import { isTimeframe } from "@/lib/market/timeframes";
import { PRIMARY_SYMBOL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = params.get("symbol") ?? PRIMARY_SYMBOL;
  const timeframe = params.get("timeframe") ?? "1M";

  if (!/^[A-Z]{1,8}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  if (!isTimeframe(timeframe)) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }

  try {
    const series = await getSeries(symbol, timeframe);
    if (!series) return NextResponse.json({ error: "Series unavailable" }, { status: 404 });
    return NextResponse.json({ series }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Series unavailable" }, { status: 503 });
  }
}
