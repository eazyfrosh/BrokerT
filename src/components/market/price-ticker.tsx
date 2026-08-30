"use client";

import { useLiveQuote } from "@/hooks/use-live-quote";
import { formatCurrency, formatPercent, formatTime } from "@/lib/format";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/market/types";

/**
 * Live-updating price display. Everything below the price is derived from the
 * same polled quote, so the header, the change and the timestamp can never
 * disagree with one another.
 */
export function PriceTicker({
  initialQuote,
  size = "md",
  showTimestamp = true,
  className,
}: {
  initialQuote: Quote;
  size?: "sm" | "md" | "lg";
  showTimestamp?: boolean;
  className?: string;
}) {
  const { quote, tick, stale } = useLiveQuote(initialQuote);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "font-semibold tracking-tight tabular transition-colors duration-300",
            size === "sm" && "text-xl",
            size === "md" && "text-3xl",
            size === "lg" && "text-4xl sm:text-5xl",
            tick === "up" && "text-gain",
            tick === "down" && "text-loss",
          )}
          aria-live="polite"
        >
          {formatCurrency(quote.price)}
        </span>
        <PerformanceBadge
          value={quote.change}
          percent={quote.changePercent}
          format="currency"
          size={size === "lg" ? "lg" : "md"}
        />
      </div>

      {showTimestamp && (
        <p className="text-xs text-muted-foreground">
          {stale ? (
            <span className="text-warning">Reconnecting to the market feed…</span>
          ) : (
            <>
              Simulated quote · updated {formatTime(quote.quotedAt)}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** One-line ticker chip used in navigation bars and cards. */
export function PriceChip({ initialQuote, className }: { initialQuote: Quote; className?: string }) {
  const { quote, tick } = useLiveQuote(initialQuote, 6000);
  const positive = quote.change >= 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm",
        className,
      )}
    >
      <span className="font-semibold">{quote.symbol}</span>
      <span
        className={cn(
          "tabular transition-colors duration-300",
          tick === "up" && "text-gain",
          tick === "down" && "text-loss",
        )}
      >
        {formatCurrency(quote.price)}
      </span>
      <span className={cn("text-xs font-medium tabular", positive ? "text-gain" : "text-loss")}>
        {formatPercent(quote.changePercent)}
      </span>
    </div>
  );
}
