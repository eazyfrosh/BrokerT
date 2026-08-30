import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { RiskMeter } from "@/components/shared/risk-meter";
import { RiskNotice } from "@/components/shared/demo-notices";
import { listMyInvestmentPositions } from "@/lib/services/investments";
import { measureInvestmentPosition } from "@/lib/calculations/investments";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "My allocations" };
export const dynamic = "force-dynamic";

export default async function ActiveInvestmentsPage() {
  await requireSession("/investments/active");
  const positions = await listMyInvestmentPositions();

  const active = positions.filter((position) => position.status === "active");
  const closed = positions.filter((position) => position.status !== "active");

  const totals = active.reduce(
    (accumulator, position) => ({
      principal: accumulator.principal + Number(position.principal),
      value: accumulator.value + Number(position.current_value),
    }),
    { principal: 0, value: 0 },
  );
  const gain = totals.value - totals.principal;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My allocations"
        description="Every strategy you are allocated to, with its progress through the term."
        actions={
          <Button asChild>
            <Link href="/investments">
              <TrendingUp /> Browse strategies
            </Link>
          </Button>
        }
      />

      <SetupNotice what="your allocations" />

      <section aria-label="Allocation summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Allocated principal" value={formatCurrency(totals.principal)} icon={BadgeCheck} />
        <StatCard label="Current value" value={formatCurrency(totals.value)} icon={TrendingUp} accent="primary" />
        <StatCard
          label="Gain / loss"
          value={formatCurrency(gain, { signed: true })}
          change={gain}
          changePercent={totals.principal > 0 ? (gain / totals.principal) * 100 : 0}
          changeFormat="currency"
          accent={gain >= 0 ? "gain" : "loss"}
        />
      </section>

      {active.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No active allocations"
          description="Allocate cash to a strategy and it will appear here with its progress and current value."
          action={
            <Button asChild size="sm">
              <Link href="/investments">Browse strategies</Link>
            </Button>
          }
        />
      ) : (
        <section aria-label="Active allocations" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((position) => {
            const metrics = measureInvestmentPosition({
              principal: Number(position.principal),
              currentValue: Number(position.current_value),
              targetReturnPct: Number(position.target_return_pct),
              startDate: position.start_date,
              targetDate: position.target_date,
            });

            return (
              <Card key={position.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">
                      {position.investments?.name ?? "Strategy"}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{position.reference}</p>
                  </div>
                  <StatusBadge status={position.status} />
                </div>

                {position.investments && (
                  <div className="mt-3">
                    <RiskMeter level={position.investments.risk_level} />
                  </div>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Invested</dt>
                    <dd className="mt-0.5 font-semibold tabular">{formatCurrency(metrics.principal)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Current value</dt>
                    <dd className="mt-0.5 font-semibold tabular">{formatCurrency(metrics.currentValue)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Gain / loss</dt>
                    <dd className="mt-0.5">
                      <PerformanceBadge value={metrics.gain} percent={metrics.gainPercent} format="currency" size="sm" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Target return</dt>
                    <dd className="mt-0.5 font-semibold tabular">
                      {formatPercent(Number(position.target_return_pct), { signed: false })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDate(position.start_date)} → {formatDate(position.target_date)}
                    </span>
                    <span className="tabular">{formatPercent(metrics.progressPercent, { signed: false })}</span>
                  </div>
                  <Progress value={metrics.progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    {metrics.daysRemaining} of {metrics.totalDays} days remaining
                  </p>
                </div>

                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={`/investments/active/${position.id}`}>View allocation</Link>
                </Button>
              </Card>
            );
          })}
        </section>
      )}

      {closed.length > 0 && (
        <section aria-label="Closed allocations" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Closed allocations
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {closed.map((position) => (
                <Link
                  key={position.id}
                  href={`/investments/active/${position.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{position.investments?.name ?? "Strategy"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {position.reference} · closed {formatDate(position.closed_at ?? position.updated_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular">{formatCurrency(Number(position.current_value))}</span>
                  <StatusBadge status={position.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Simulated</Badge>
        <RiskNotice
          className="flex-1"
          detail="Allocation values shown here are simulated and do not represent real assets under management."
        />
      </div>
    </div>
  );
}
