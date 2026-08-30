import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RiskMeter } from "@/components/shared/risk-meter";
import { StatusBadge } from "@/components/shared/status-badge";
import { capacityProgress } from "@/lib/calculations/investments";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Investment } from "@/types/database";

export function InvestmentCard({ investment }: { investment: Investment }) {
  const progress = capacityProgress(Number(investment.raised_amount), investment.capacity_amount);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <Badge variant="secondary">{investment.category}</Badge>
        {investment.status !== "open" && <StatusBadge status={investment.status} />}
      </div>

      <h3 className="mt-3.5 text-base font-semibold tracking-tight">{investment.name}</h3>
      <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {investment.summary}
      </p>

      <div className="mt-4">
        <RiskMeter level={investment.risk_level} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Target</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular">
            {formatPercent(Number(investment.target_return_pct), { signed: false })}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Term</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular">{investment.duration_months} months</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Minimum</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular">
            {formatCurrency(Number(investment.minimum_amount), { decimals: 0 })}
          </dd>
        </div>
      </dl>

      {progress !== null && (
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Capacity allocated</span>
            <span className="tabular">{formatPercent(progress, { signed: false })}</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      <p className="mt-4 text-[0.6875rem] leading-relaxed text-muted-foreground">
        Target return is an illustrative projection based on simulated performance. It is not
        guaranteed and your capital is at risk.
      </p>

      <Button asChild variant="outline" className="mt-4">
        <Link href={`/investments/${investment.slug}`}>Review strategy</Link>
      </Button>
    </Card>
  );
}
