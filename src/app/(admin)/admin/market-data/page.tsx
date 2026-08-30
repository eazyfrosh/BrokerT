import type { Metadata } from "next";
import { Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { PriceChart } from "@/components/market/price-chart";
import { getMarketOverview } from "@/lib/services/market";
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { serverEnv } from "@/lib/config";

export const metadata: Metadata = { title: "Market data · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMarketDataPage() {
  await requireAdmin();
  const { asset, quote, series, status } = await getMarketOverview("3M");
  const env = serverEnv();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market data"
        description="The active data source and the quote every valuation on the platform is priced against."
      />

      <SetupNotice what="market data" />

      <Alert variant="warning">
        <Database />
        <AlertTitle>Simulated provider active</AlertTitle>
        <AlertDescription>
          The built-in demo engine advances a stored quote with a mean-reverting random walk when it is
          read. It is not a market feed. To connect a licensed provider, implement the
          <code className="mx-1 font-mono text-xs">MarketDataProvider</code> interface, register it in
          <code className="mx-1 font-mono text-xs">src/lib/market/provider.ts</code> and set
          <code className="mx-1 font-mono text-xs">MARKET_DATA_PROVIDER</code>. Nothing else in the
          application changes.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Provider" value={env.marketDataProvider} hint="MARKET_DATA_PROVIDER" />
        <StatCard label="API key" value={env.marketDataApiKey ? "Configured" : "Not set"} />
        <StatCard label="Instrument" value={asset?.symbol ?? "—"} hint={asset?.name ?? undefined} />
        <StatCard
          label="Last tick"
          value={quote ? formatCurrency(quote.price) : "—"}
          hint={quote ? formatDateTime(quote.quotedAt) : undefined}
        />
      </section>

      {!quote ? (
        <EmptyState title="No quote available" description="The instrument has no stored quote." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Stored price history</CardTitle>
            </CardHeader>
            <CardContent>
              {series && series.candles.length > 0 ? (
                <PriceChart candles={series.candles} style="candlestick" indicators={["volume"]} height={300} />
              ) : (
                <EmptyState title="No candles stored" compact />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Current quote</CardTitle>
              <MarketStatusPill status={status} />
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {[
                  ["Price", formatCurrency(quote.price)],
                  ["Previous close", formatCurrency(quote.previousClose)],
                  ["Open", formatCurrency(quote.open)],
                  ["Day high", formatCurrency(quote.dayHigh)],
                  ["Day low", formatCurrency(quote.dayLow)],
                  ["Volume", formatCompactNumber(quote.volume)],
                  ["Market cap", formatCompactCurrency(quote.marketCap)],
                  ["52-week high", formatCurrency(quote.week52High)],
                  ["52-week low", formatCurrency(quote.week52Low)],
                  ["Source", quote.source],
                  ["Quoted at", formatDateTime(quote.quotedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center gap-2">
                <Badge variant={quote.isSimulated ? "warning" : "success"}>
                  {quote.isSimulated ? "Simulated" : "Live"}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Portfolio valuations and order fills both price against this record.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
