import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Banknote, PieChart, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { RiskNotice, SimulatedDataNotice } from "@/components/shared/demo-notices";
import { AllocationChart } from "@/components/portfolio/allocation-chart";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { PerformancePanel } from "@/components/portfolio/performance-panel";
import { getPortfolio, getPortfolioHistory } from "@/lib/services/portfolio";
import { formatCurrency, formatPercent } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  await requireSession("/portfolio");

  const [portfolio, snapshots] = await Promise.all([getPortfolio(), getPortfolioHistory(null)]);

  const history = snapshots.map((snapshot) => ({
    date: snapshot.captured_on,
    value: Number(snapshot.total_value),
  }));

  // A live point keeps the chart honest between nightly snapshots.
  if (portfolio && portfolio.totalValue > 0) {
    const today = new Date().toISOString().slice(0, 10);
    if (history.at(-1)?.date !== today) {
      history.push({ date: today, value: portfolio.totalValue });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Portfolio"
        description="Every figure here is calculated from your holdings and the current quote."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/deposits">
                <Banknote /> Add funds
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

      <SetupNotice what="your portfolio" />

      <section aria-label="Portfolio summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total value"
          value={formatCurrency(portfolio?.totalValue ?? 0)}
          icon={PieChart}
          accent="primary"
          hint="Holdings, strategies and cash"
        />
        <StatCard
          label="Total invested"
          value={formatCurrency(portfolio?.totalInvested ?? 0)}
          icon={TrendingUp}
          hint="Cost basis plus allocated principal"
        />
        <StatCard
          label="Today"
          value={formatCurrency(portfolio?.dayPnl ?? 0, { signed: true })}
          change={portfolio?.dayPnl ?? 0}
          changePercent={portfolio?.dayReturnPercent ?? 0}
          changeFormat="currency"
          accent={(portfolio?.dayPnl ?? 0) >= 0 ? "gain" : "loss"}
          icon={TrendingUp}
        />
        <StatCard
          label="Cash balance"
          value={formatCurrency(portfolio?.cashBalance ?? 0)}
          icon={Wallet}
          hint={
            portfolio && portfolio.reservedBalance > 0
              ? `${formatCurrency(portfolio.reservedBalance)} reserved`
              : undefined
          }
        />
      </section>

      {/* Realised / unrealised breakdown */}
      {portfolio && (
        <Card>
          <CardContent className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Holdings value", formatCurrency(portfolio.holdingsValue)],
              ["Cost basis", formatCurrency(portfolio.costBasis)],
              ["Unrealised P/L", formatCurrency(portfolio.unrealizedPnl, { signed: true })],
              ["Realised P/L", formatCurrency(portfolio.realizedPnl, { signed: true })],
              ["Strategy allocations", formatCurrency(portfolio.investedValue)],
              ["Allocated principal", formatCurrency(portfolio.investedPrincipal)],
              ["Total P/L", formatCurrency(portfolio.totalPnl, { signed: true })],
              ["Total return", formatPercent(portfolio.totalReturnPercent)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-base font-semibold tabular">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformancePanel history={history} />
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              History is built from a daily snapshot of your account value. A new account has no history
              until its first snapshot is captured.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AllocationChart slices={portfolio?.allocation ?? []} className="flex-col sm:flex-col" size={150} />
            <RiskNotice className="border-t border-border pt-4" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Holdings</CardTitle>
          <SimulatedDataNotice className="hidden sm:flex" />
        </CardHeader>
        <CardContent>
          <HoldingsTable holdings={portfolio?.holdings ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
