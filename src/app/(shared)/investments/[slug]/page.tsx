import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { RiskMeter } from "@/components/shared/risk-meter";
import { StatusBadge } from "@/components/shared/status-badge";
import { RiskAlert } from "@/components/shared/demo-notices";
import { AllocatePanel } from "@/components/investments/allocate-panel";
import { PerformanceChart } from "@/components/portfolio/performance-chart";
import { getInvestmentBySlug } from "@/lib/services/investments";
import { getMyWallet } from "@/lib/services/transactions";
import { capacityProgress, RISK_LEVEL_LABELS } from "@/lib/calculations/investments";
import { simulateStrategyHistory } from "@/lib/simulation";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const investment = await getInvestmentBySlug(slug);
  if (!investment) return { title: "Strategy" };
  return { title: investment.name, description: investment.summary };
}

export default async function InvestmentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [investment, session] = await Promise.all([getInvestmentBySlug(slug), getSessionContext()]);
  if (!investment) notFound();

  const wallet = session ? await getMyWallet() : null;
  const inApp = Boolean(session);

  const progress = capacityProgress(Number(investment.raised_amount), investment.capacity_amount);
  const history = simulateStrategyHistory({
    seed: investment.slug,
    months: Math.min(Math.max(investment.duration_months * 2, 24), 60),
    annualReturnPct: Number(investment.target_return_pct),
    riskLevel: investment.risk_level,
  });

  const facts: [string, string][] = [
    ["Category", investment.category],
    ["Risk level", RISK_LEVEL_LABELS[investment.risk_level]],
    ["Target return", formatPercent(Number(investment.target_return_pct), { signed: false })],
    ["Target duration", `${investment.duration_months} months`],
    ["Minimum investment", formatCurrency(Number(investment.minimum_amount))],
    [
      "Maximum investment",
      investment.maximum_amount === null ? "No maximum" : formatCurrency(Number(investment.maximum_amount)),
    ],
    ["Management fee", formatPercent(Number(investment.management_fee_pct), { signed: false })],
    [
      "Performance fee",
      Number(investment.performance_fee_pct) > 0
        ? formatPercent(Number(investment.performance_fee_pct), { signed: false })
        : "None",
    ],
  ];

  return (
    <div className={inApp ? "space-y-5" : "mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8"}>
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/investments">
          <ArrowLeft /> All strategies
        </Link>
      </Button>

      <PageHeader title={investment.name} description={investment.summary}>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="secondary">{investment.category}</Badge>
          <StatusBadge status={investment.status} />
          {investment.is_simulated && <Badge variant="warning">Simulated performance</Badge>}
          <RiskMeter level={investment.risk_level} />
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <div className="space-y-5">
          {investment.objective && (
            <Card>
              <CardHeader>
                <CardTitle>Investment objective</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{investment.objective}</p>
              </CardContent>
            </Card>
          )}

          {investment.description && (
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{investment.description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Simulated performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PerformanceChart points={history} height={240} />
              <p className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed">
                <strong className="font-medium">This is not real performance data.</strong> The series
                above is generated by the demo engine to illustrate the shape of the strategy at its
                stated risk level. It does not represent any real portfolio, any real investor&apos;s
                result, or any claim about future returns.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key facts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              {progress !== null && (
                <div className="mt-4 space-y-1.5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatCurrency(Number(investment.raised_amount))} of{" "}
                      {formatCurrency(Number(investment.capacity_amount))} allocated
                    </span>
                    <span className="tabular">{formatPercent(progress, { signed: false })}</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{investment.risk_disclosure}</p>
              <RiskAlert />
            </CardContent>
          </Card>

          {investment.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{investment.terms}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle>Allocate to this strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocatePanel
                investment={investment}
                availableCash={Number(wallet?.available_balance ?? 0)}
                signedIn={Boolean(session)}
                accountActive={session?.profile.account_status === "active"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
