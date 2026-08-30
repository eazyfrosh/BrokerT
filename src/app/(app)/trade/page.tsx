import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { SimulatedDataNotice } from "@/components/shared/demo-notices";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriceTicker } from "@/components/market/price-ticker";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { QuoteStats } from "@/components/market/quote-stats";
import { MarketTerminal } from "@/components/market/market-terminal";
import { OrderTicket } from "@/components/trade/order-ticket";
import { getMarketOverview } from "@/lib/services/market";
import { getHoldingForAsset } from "@/lib/services/portfolio";
import { getMyWallet } from "@/lib/services/transactions";
import { listMyOrders } from "@/lib/services/orders";
import { valueHolding } from "@/lib/calculations/portfolio";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Trade",
  description: "Professional trading terminal for TSLA. Demo orders, simulated prices.",
};
export const dynamic = "force-dynamic";

export default async function TradePage() {
  const session = await requireSession("/trade");
  const { asset, quote, series, status } = await getMarketOverview("3M");

  if (!asset || !quote) {
    return (
      <div className="space-y-5">
        <PageHeader title="Trade" description="Trading terminal" />
        <SetupNotice what="market data" />
        <EmptyState
          title="Trading is unavailable"
          description="No quote is currently available for the primary instrument."
        />
      </div>
    );
  }

  const [holding, wallet, workingOrders] = await Promise.all([
    getHoldingForAsset(asset.id),
    getMyWallet(),
    listMyOrders({ limit: 50 }),
  ]);

  const open = workingOrders.filter(
    (order) => order.status === "submitted" || order.status === "pending" || order.status === "partially_filled",
  );

  const valuation =
    holding.quantity > 0
      ? valueHolding({
          symbol: asset.symbol,
          name: asset.name,
          quantity: holding.quantity,
          averageCost: holding.averageCost,
          currentPrice: quote.price,
          previousClose: quote.previousClose,
        })
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trade"
        description="Market information, chart and order ticket — all backed by the same server-side price."
        actions={
          <Button asChild variant="outline">
            <Link href="/orders">
              <ClipboardList /> Order history
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,20rem)]">
        {/* ----------------------------------------------------------- */}
        {/* Left: market information                                     */}
        {/* ----------------------------------------------------------- */}
        <div className="space-y-5 xl:order-1">
          <Card>
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="truncate">{asset.name}</CardTitle>
                <Badge variant="secondary" className="font-mono text-[0.6875rem]">{asset.symbol}</Badge>
              </div>
              <PriceTicker initialQuote={quote} size="sm" showTimestamp={false} />
              <MarketStatusPill status={status} className="self-start" />
            </CardHeader>
            <CardContent className="space-y-4">
              <QuoteStats quote={quote} className="grid-cols-2 sm:grid-cols-2" />
              <SimulatedDataNotice />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your position</CardTitle>
            </CardHeader>
            <CardContent>
              {valuation ? (
                <dl className="space-y-2.5 text-sm">
                  {[
                    ["Quantity", `${formatQuantity(valuation.quantity)} ${asset.symbol}`],
                    ["Average cost", formatCurrency(valuation.averageCost)],
                    ["Market value", formatCurrency(valuation.marketValue)],
                    ["Unrealised P/L", formatCurrency(valuation.unrealizedPnl, { signed: true })],
                    ["Available cash", formatCurrency(Number(wallet?.available_balance ?? 0))],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You do not hold {asset.symbol} yet.
                  </p>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Available cash</span>
                    <span className="font-medium tabular">
                      {formatCurrency(Number(wallet?.available_balance ?? 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Centre: chart                                                */}
        {/* ----------------------------------------------------------- */}
        <div className="space-y-5 xl:order-2">
          <Card>
            <CardHeader>
              <CardTitle>{asset.symbol} price</CardTitle>
            </CardHeader>
            <CardContent>
              {series ? (
                <MarketTerminal symbol={asset.symbol} initialSeries={series} height={380} />
              ) : (
                <EmptyState title="No price history" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Working orders</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/orders">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {open.length === 0 ? (
                <EmptyState
                  title="No working orders"
                  description="Resting limit and stop orders appear here until they fill or are cancelled."
                  compact
                />
              ) : (
                <ul className="divide-y divide-border">
                  {open.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium capitalize">
                            {order.side} {formatQuantity(order.quantity)} {order.assets?.symbol}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.reference} · {order.order_type.replace(/_/g, " ")} ·{" "}
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Right: order ticket                                          */}
        {/* ----------------------------------------------------------- */}
        <div className="xl:order-3">
          <Card className="xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle>Order ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTicket
                assetId={asset.id}
                initialQuote={quote}
                availableCash={Number(wallet?.available_balance ?? 0)}
                positionQuantity={holding.quantity}
                averageCost={holding.averageCost}
                accountActive={session.profile.account_status === "active"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
