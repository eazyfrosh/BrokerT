"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PerformancePoint {
  date: string;
  value: number;
}

interface TooltipPayload {
  value: number;
  payload: PerformancePoint;
}

function PerformanceTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDate(point.date)}</p>
      <p className="mt-0.5 text-sm font-semibold tabular text-popover-foreground">
        {formatCurrency(point.value)}
      </p>
    </div>
  );
}

/**
 * Portfolio value over time.
 *
 * A single series, so no legend box is needed — the surrounding card names it.
 * Direction is carried by the fill colour and by the signed change shown above
 * the chart, never by colour alone.
 */
export function PerformanceChart({
  points,
  height = 260,
  className,
}: {
  points: PerformancePoint[];
  height?: number;
  className?: string;
}) {
  const rising = points.length > 1 && points[points.length - 1].value >= points[0].value;
  const stroke = rising ? "var(--gain)" : "var(--loss)";
  const gradientId = React.useId();

  if (points.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}
        style={{ height }}
      >
        Not enough history to plot yet. Your first snapshot appears after a day of activity.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactCurrency(value)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={<PerformanceTooltip />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
