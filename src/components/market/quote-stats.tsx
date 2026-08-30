import { formatCompactCurrency, formatCompactNumber, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/market/types";

interface Row {
  label: string;
  value: string;
}

/** The key-statistics grid shown beneath a quote. */
export function QuoteStats({ quote, className }: { quote: Quote; className?: string }) {
  const rows: Row[] = [
    { label: "Previous close", value: formatCurrency(quote.previousClose) },
    { label: "Open", value: formatCurrency(quote.open) },
    { label: "Day high", value: formatCurrency(quote.dayHigh) },
    { label: "Day low", value: formatCurrency(quote.dayLow) },
    { label: "Volume", value: formatCompactNumber(quote.volume) },
    { label: "Market cap", value: formatCompactCurrency(quote.marketCap) },
    { label: "52-week high", value: formatCurrency(quote.week52High) },
    { label: "52-week low", value: formatCurrency(quote.week52Low) },
  ];

  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4", className)}>
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 text-sm font-medium tabular">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
