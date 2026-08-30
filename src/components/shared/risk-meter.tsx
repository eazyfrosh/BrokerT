import { cn } from "@/lib/utils";
import { RISK_LEVEL_LABELS, RISK_LEVEL_SCORE } from "@/lib/calculations/investments";
import type { RiskLevel } from "@/types/database";

const TONE: Record<RiskLevel, string> = {
  conservative: "bg-chart-2",
  moderate: "bg-chart-2",
  balanced: "bg-chart-3",
  growth: "bg-chart-3",
  aggressive: "bg-chart-4",
};

export function RiskMeter({
  level,
  className,
  showLabel = true,
}: {
  level: RiskLevel;
  className?: string;
  showLabel?: boolean;
}) {
  const score = RISK_LEVEL_SCORE[level];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-0.5" role="img" aria-label={`Risk level: ${RISK_LEVEL_LABELS[level]}, ${score} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn("h-3.5 w-1.5 rounded-full", i < score ? TONE[level] : "bg-muted")}
          />
        ))}
      </div>
      {showLabel && <span className="text-xs font-medium text-muted-foreground">{RISK_LEVEL_LABELS[level]} risk</span>}
    </div>
  );
}
