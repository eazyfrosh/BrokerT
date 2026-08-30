"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AllocationSlice } from "@/lib/calculations/portfolio";

/**
 * Categorical slots are assigned in fixed order and never cycled — the colour
 * of a slice follows its position in the allocation, so adding a holding never
 * repaints the others. Identity is carried by the labelled legend, not colour.
 */
const SLOT = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/** Cash is always the last, most recessive slot regardless of its size. */
const CASH_COLOR = "var(--muted-foreground)";

function colorFor(slice: AllocationSlice, index: number): string {
  if (slice.label === "Cash") return CASH_COLOR;
  return SLOT[index % SLOT.length];
}

interface TooltipPayload {
  payload: AllocationSlice;
}

function AllocationTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{slice.label}</p>
      <p className="mt-0.5 tabular text-muted-foreground">
        {formatCurrency(slice.value)} · {formatPercent(slice.percent, { signed: false })}
      </p>
    </div>
  );
}

export function AllocationChart({
  slices,
  className,
  size = 168,
}: {
  slices: AllocationSlice[];
  className?: string;
  size?: number;
}) {
  const total = React.useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);

  if (slices.length === 0 || total === 0) {
    return (
      <p className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        Nothing allocated yet.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-center", className)}>
      <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              /* 2px of surface between segments keeps adjacent fills readable. */
              paddingAngle={1.5}
              strokeWidth={2}
              stroke="var(--card)"
              isAnimationActive={false}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.label} fill={colorFor(slice, index)} />
              ))}
            </Pie>
            <Tooltip content={<AllocationTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Hero value in the hole — the headline the donut exists to support. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Total</span>
          <span className="text-base font-semibold tabular">{formatCurrency(total, { decimals: 0 })}</span>
        </div>
      </div>

      {/* The legend doubles as the table view: every slice is named and valued. */}
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: colorFor(slice, index) }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm">{slice.label}</span>
            <span className="shrink-0 text-sm tabular">{formatCurrency(slice.value)}</span>
            <span className="w-14 shrink-0 text-right text-sm tabular text-muted-foreground">
              {formatPercent(slice.percent, { signed: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
