"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimeSeriesPoint } from "@/lib/services/admin";

interface TooltipPayload {
  value: number;
  payload: TimeSeriesPoint;
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDate(label)}</p>
      <p className="mt-0.5 text-sm font-semibold tabular text-popover-foreground">
        {payload[0].value} {label ? "" : ""}
      </p>
    </div>
  );
}

/**
 * Daily counts. One series, so no legend box — the card title names it.
 * A single hue is correct here: the bars encode magnitude, not identity.
 */
export function ActivityChart({
  points,
  color = "var(--chart-1)",
  height = 200,
  className,
}: {
  points: TimeSeriesPoint[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}
        style={{ height }}
      >
        No activity in this window.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ActivityTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          {/* 4px rounded data-end anchored to the baseline. */}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
