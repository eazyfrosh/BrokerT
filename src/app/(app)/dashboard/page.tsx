import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ClipboardList,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { DemoModeAlert, SimulatedDataNotice, RiskNotice } from "@/components/shared/demo-notices";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AllocationChart } from "@/components/portfolio/allocation-chart";
import { PriceTicker } from "@/components/market/price-ticker";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { PriceChart } from "@/components/market/price-chart";
import { getPortfolio } from "@/lib/services/portfolio";
import { listMyOrders } from "@/lib/services/orders";
import { listMyInvestmentPositions } from "@/lib/services/investments";
import { getMarketOverview } from "@/lib/services/market";
import { measureInvestmentPosition } from "@/lib/calculations/investments";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import { requireSession, displayName } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession("/dashboard");

  const [portfolio, orders, positions, market] = await Promise.all([
    getPortfolio(),
    listMyOrders({ limit: 5 }),
    listMyInvestmentPositions("active"),
    getMarketOverview("3M"),
  ]);

  const investedTotal = positions.reduce((sum, p) => sum + Number(p.current_value), 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Welcome back, {displayName(session.profile)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here is where your account stands right now.
        </p>
      </header>

      <SetupNotice what="your account data" />
      <DemoModeAlert />

      {/* --------------------------------------------------------------- */}
      {/* Summary                                                          */}
      {/* --------------------------------------------------------------- */}
      <section aria-label="Account summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total portfolio"
          value={formatCurrency(portfolio?.totalValue ?? 0)}
          icon={PieChart}
          accent="primary"
          hint="Holdings, strategies and cash"
        />
        <StatCard
          label="Today's return"
          value={formatCurrency(portfolio?.dayPnl ?? 0, { signed: true })}
          change={portfolio?.dayPnl ?? 0}
          changePercent={portfolio?.dayReturnPercent ?? 0}
          changeFormat="currency"
          icon={TrendingUp}
          accent={(portfolio?.dayPnl ?? 0) >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Total return"
          value={formatCurrency(portfolio?.totalPnl ?? 0, { signed: true })}
          change={portfolio?.totalPnl ?? 0}
          changePercent={portfolio?.totalReturnPercent ?? 0}
          changeFormat="currency"
          icon={TrendingUp}
          accent={(portfolio?.totalPnl ?? 0) >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Available cash"
          value={formatCurrency(portfolio?.cashBalance ?? 0)}
          icon={Wallet}
          hint={
            portfolio && portfolio.reservedBalance > 0
              ? `${formatCurrency(portfolio.reservedBalance)} reserved for working orders`
              : "Ready to invest"
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------------- */}
        {/* Allocation                                                     */}
        {/* ------------------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Portfolio allocation</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/portfolio">
                Full portfolio <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {portfolio && portfolio.allocation.length > 0 ? (
              <>
                <AllocationChart slices={portfolio.allocation} />
                <RiskNotice className="mt-5 border-t border-border pt-4" />
              </>
            ) : (
              <EmptyState
                icon={PieChart}
                title="Your portfolio is empty"
                description="Fund your demo account, then place your first order to see an allocation here."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm">
                      <Link href="/deposits">Add demo funds</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/trade">Place an order</Link>
                    </Button>
                  </div>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------- */}
        {/* Market snapshot                                                */}
        {/* ------------------------------------------------------------- */}
        <Card className="flex flex-col">
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Tesla, Inc.</CardTitle>
              <Badge variant="secondary" className="font-mono text-[0.6875rem]">TSLA</Badge>
            </div>
            {market.quote ? (
              <PriceTicker initialQuote={market.quote} size="sm" showTimestamp={false} />
            ) : (
              <p className="text-sm text-muted-foreground">Market data unavailable</p>
            )}
            <MarketStatusPill status={market.status} className="self-start" />
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-3 p-0">
            {market.series && market.series.candles.length > 0 ? (
              <PriceChart
                candles={market.series.candles}
                style="area"
                height={150}
                showPriceScale={false}
                showTimeScale={false}
              />
            ) : (
              <div className="px-5">
                <EmptyState title="No chart data" compact />
              </div>
            )}

            <div className="mt-auto space-y-3 px-5 pb-5">
              <SimulatedDataNotice />
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="sm">
                  <Link href="/trade">
                    <ArrowLeftRight /> Trade
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/markets">Markets</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------------- */}
        {/* Recent orders                                                  */}
        {/* ------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">
                All orders <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No orders yet"
                description="Orders you place appear here with their live status."
                compact
                action={
                  <Button asChild size="sm">
                    <Link href="/trade">Open the trading terminal</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="capitalize">{order.side}</span>{" "}
                          {formatQuantity(order.quantity)} {order.assets?.symbol ?? ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.reference} · {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm tabular">
                          {formatCurrency(
                            (order.average_fill_price ?? order.estimated_price ?? 0) * order.quantity,
                          )}
                        </p>
                        <StatusBadge status={order.status} className="mt-1" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------- */}
        {/* Active allocations                                             */}
        {/* ------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Active allocations</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/investments/active">
                All allocations <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No active allocations"
                description="Strategies you allocate to appear here with their progress."
                compact
                action={
                  <Button asChild size="sm">
                    <Link href="/investments">Browse strategies</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold tabular text-foreground">
                    {formatCurrency(investedTotal)}
                  </span>{" "}
                  across {positions.length} {positions.length === 1 ? "strategy" : "strategies"}
                </p>
                <ul className="divide-y divide-border">
                  {positions.slice(0, 4).map((position) => {
                    const metrics = measureInvestmentPosition({
                      principal: Number(position.principal),
                      currentValue: Number(position.current_value),
                      targetReturnPct: Number(position.target_return_pct),
                      startDate: position.start_date,
                      targetDate: position.target_date,
                    });
                    return (
                      <li key={position.id}>
                        <Link
                          href={`/investments/active/${position.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {position.investments?.name ?? "Strategy"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {metrics.daysRemaining} days remaining · matures {formatDate(position.target_date)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm tabular">{formatCurrency(metrics.currentValue)}</p>
                            <PerformanceBadge
                              value={metrics.gain}
                              format="currency"
                              size="sm"
                              className="mt-0.5"
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Quick actions                                                    */}
      {/* --------------------------------------------------------------- */}
      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/trade", label: "Place an order", icon: ArrowLeftRight },
          { href: "/deposits", label: "Add demo funds", icon: Banknote },
          { href: "/investments", label: "Browse strategies", icon: TrendingUp },
          { href: "/cars", label: "Configure a vehicle", icon: ClipboardList },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
              <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
