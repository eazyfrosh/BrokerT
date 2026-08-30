import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent, formatCurrency } from "@/lib/format";

interface PerformanceBadgeProps {
  value: number | null | undefined;
  /** When provided, renders "+$12.40 (+1.24%)". */
  percent?: number | null;
  format?: "percent" | "currency";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

/**
 * Directional colour + icon for a change figure. Colour alone never carries the
 * meaning — the sign and the arrow do too, so it reads without colour vision.
 */
export function PerformanceBadge({
  value,
  percent,
  format = "percent",
  size = "md",
  showIcon = true,
  className,
}: PerformanceBadgeProps) {
  const numeric = value ?? 0;
  const direction = numeric > 0 ? "up" : numeric < 0 ? "down" : "flat";

  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  const primary =
    format === "currency" ? formatCurrency(numeric, { signed: true }) : formatPercent(numeric);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-base",
        direction === "up" && "text-gain",
        direction === "down" && "text-loss",
        direction === "flat" && "text-muted-foreground",
        className,
      )}
    >
      {showIcon && <Icon className={cn(size === "lg" ? "size-4" : "size-3.5")} aria-hidden />}
      {primary}
      {percent !== undefined && percent !== null && (
        <span className="opacity-80">({formatPercent(percent)})</span>
      )}
    </span>
  );
}
