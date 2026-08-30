import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PerformanceBadge } from "./performance-badge";

interface StatCardProps {
  label: string;
  value: string;
  /** Secondary line under the value. */
  hint?: string;
  change?: number | null;
  changePercent?: number | null;
  changeFormat?: "percent" | "currency";
  icon?: LucideIcon;
  accent?: "default" | "gain" | "loss" | "primary";
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  hint,
  change,
  changePercent,
  changeFormat = "currency",
  icon: Icon,
  accent = "default",
  className,
  children,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              accent === "primary" && "bg-primary/10 text-primary",
              accent === "gain" && "bg-success/12 text-success",
              accent === "loss" && "bg-destructive/12 text-destructive",
              accent === "default" && "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>

      <p className="mt-2.5 text-2xl font-semibold tracking-tight tabular sm:text-[1.75rem]">{value}</p>

      {(change !== undefined && change !== null) || hint ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {change !== undefined && change !== null && (
            <PerformanceBadge value={change} percent={changePercent} format={changeFormat} size="sm" />
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      ) : null}

      {children}
    </Card>
  );
}
