"use client";

import Link from "next/link";
import { useLiveQuote } from "@/hooks/use-live-quote";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/market/types";

/** Compact live quote pinned to the bottom of the desktop sidebar. */
export function SidebarQuote({ quote: initialQuote }: { quote: Quote }) {
  const { quote, tick } = useLiveQuote(initialQuote, 6000);
  const positive = quote.change >= 0;

  return (
    <Link
      href="/markets"
      className="block rounded-lg border border-sidebar-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{quote.symbol}</span>
        <span className={cn("text-xs font-medium tabular", positive ? "text-gain" : "text-loss")}>
          {formatPercent(quote.changePercent)}
        </span>
      </div>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular transition-colors duration-300",
          tick === "up" && "text-gain",
          tick === "down" && "text-loss",
        )}
      >
        {formatCurrency(quote.price)}
      </p>
      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Simulated quote</p>
    </Link>
  );
}
