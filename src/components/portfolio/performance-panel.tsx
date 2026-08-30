"use client";

import * as React from "react";
import { PerformanceChart, type PerformancePoint } from "./performance-chart";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { formatCurrency } from "@/lib/format";
import { round } from "@/lib/utils";

const RANGES = [
  { value: "1D", label: "1D", days: 1 },
  { value: "1W", label: "1W", days: 7 },
  { value: "1M", label: "1M", days: 31 },
  { value: "3M", label: "3M", days: 93 },
  { value: "6M", label: "6M", days: 186 },
  { value: "1Y", label: "1Y", days: 366 },
  { value: "ALL", label: "All", days: null },
] as const;

/**
 * Portfolio value over time. The window is applied client-side to the history
 * the server already sent, so switching range is instant and makes no request.
 */
export function PerformancePanel({ history }: { history: PerformancePoint[] }) {
  const [range, setRange] = React.useState<string>("1M");

  const points = React.useMemo(() => {
    const spec = RANGES.find((r) => r.value === range);
    if (!spec?.days || history.length === 0) return history;

    // Window relative to the newest point rather than to the wall clock: the
    // series ends at the latest snapshot, and reading the clock during render
    // would make this impure.
    const latest = new Date(history[history.length - 1].date).getTime();
    const cutoff = latest - spec.days * 86_400_000;
    return history.filter((point) => new Date(point.date).getTime() >= cutoff);
  }, [history, range]);

  const change = React.useMemo(() => {
    if (points.length < 2) return { absolute: 0, percent: 0 };
    const first = points[0].value;
    const last = points[points.length - 1].value;
    return {
      absolute: round(last - first, 2),
      percent: first > 0 ? round(((last - first) / first) * 100, 2) : 0,
    };
  }, [points]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular">
            {formatCurrency(points.at(-1)?.value ?? 0)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <PerformanceBadge value={change.absolute} percent={change.percent} format="currency" size="sm" />
            <span className="text-xs text-muted-foreground">over {range === "ALL" ? "all time" : range}</span>
          </div>
        </div>

        <FilterTabs
          options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          value={range}
          onChange={setRange}
          ariaLabel="Performance range"
        />
      </div>

      <PerformanceChart points={points} />
    </div>
  );
}
