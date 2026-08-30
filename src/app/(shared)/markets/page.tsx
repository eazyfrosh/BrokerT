import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { SimulatedDataNotice, RiskNotice } from "@/components/shared/demo-notices";
import { PriceTicker } from "@/components/market/price-ticker";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { QuoteStats } from "@/components/market/quote-stats";
import { MarketTerminal } from "@/components/market/market-terminal";
import { getMarketOverview } from "@/lib/services/market";
import { getSessionContext } from "@/lib/auth";
import { formatCurrency, formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Follow TSLA on a professional market terminal: eight timeframes, three chart styles and five indicators. Prices are simulated in demo mode.",
};
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [{ asset, quote, series, status }, session] = await Promise.all([
    getMarketOverview("1M"),
    getSessionContext(),
  ]);

  const inApp = Boolean(session);

  return (
    <div className={inApp ? "space-y-6" : "mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"}>
      <PageHeader
        title="Markets"
        description="A single instrument, covered properly. Every figure below is simulated demo data."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/watchlist">
                <Star /> Watchlist
              </Link>
            </Button>
            <Button asChild>
              <Link href="/trade">
                <ArrowLeftRight /> Trade
              </Link>
            </Button>
          </>
        }
      />

      <SetupNotice what="market data" />

      {!quote || !asset ? (
        <EmptyState
          title="Market data unavailable"
          description="No quote is currently available for the primary instrument."
        />
      ) : (
        <>
          {/* ----------------------------------------------------------- */}
          {/* Instrument header                                            */}
          {/* ----------------------------------------------------------- */}
          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">{asset.name}</h2>
                  <Badge variant="secondary" className="font-mono text-[0.6875rem]">
                    {asset.symbol}
                  </Badge>
                  {asset.exchange && <Badge variant="outline">{asset.exchange}</Badge>}
                </div>
                <PriceTicker initialQuote={quote} size="lg" />
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <MarketStatusPill status={status} />
                <p className="text-xs text-muted-foreground">
                  {asset.sector ?? "—"} · {quote.currency}
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <QuoteStats quote={quote} />

              {/* Where today's price sits inside the 52-week range. */}
              {quote.week52High !== null && quote.week52Low !== null && quote.week52High > quote.week52Low && (
                <div className="space-y-1.5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>52-week range</span>
                    <span className="tabular">
                      {formatCurrency(quote.week52Low)} – {formatCurrency(quote.week52High)}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted">
                    <span
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                      style={{
                        left: `${Math.min(
                          Math.max(
                            ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100,
                            0,
                          ),
                          100,
                        )}%`,
                      }}
                      aria-hidden
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Trading at {formatCurrency(quote.price)}, {formatPercent(
                      ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100,
                      { signed: false },
                    )} of the way through the simulated 52-week range.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------- */}
          {/* Chart                                                        */}
          {/* ----------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
            </CardHeader>
            <CardContent>
              {series ? (
                <MarketTerminal symbol={asset.symbol} initialSeries={series} />
              ) : (
                <EmptyState title="No price history" description="Chart data is not available yet." />
              )}
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------- */}
          {/* About + disclosures                                          */}
          {/* ----------------------------------------------------------- */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>About {asset.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{asset.description}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/tesla">Read the full overview</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data and disclosures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SimulatedDataNotice />
                <RiskNotice />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Market data may be delayed. This page is for information only and is not investment
                  advice or a recommendation to buy or sell any security.
                </p>
                <Button asChild variant="ghost" size="sm" className="px-0">
                  <Link href="/risk-disclosure">Full risk disclosure</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
