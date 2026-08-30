import { NextResponse, type NextRequest } from "next/server";
import { getQuote } from "@/lib/services/market";
import { getMarketStatus } from "@/lib/market/session";
import { PRIMARY_SYMBOL } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Live quote endpoint polled by the client price ticker.
 *
 * Quotes are public reference data, so this route is readable without a
 * session — the same data the marketing pages render server-side.
 */
export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get("symbol") ?? PRIMARY_SYMBOL;

  // Symbols are short uppercase tickers; reject anything else rather than
  // forwarding arbitrary strings into the data layer.
  if (!/^[A-Z]{1,8}$/.test(symbolParam)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    const quote = await getQuote(symbolParam);
    if (!quote) {
      return NextResponse.json({ error: "Quote unavailable" }, { status: 404 });
    }
    return NextResponse.json(
      { quote, status: getMarketStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Quote unavailable" }, { status: 503 });
  }
}
