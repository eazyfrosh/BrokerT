import { cn } from "@/lib/utils";
import type { MarketStatus } from "@/lib/market/types";

export function MarketStatusPill({ status, className }: { status: MarketStatus; className?: string }) {
  const tone =
    status.state === "open"
      ? "text-gain"
      : status.state === "closed"
        ? "text-muted-foreground"
        : "text-warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status.state === "open" && "animate-pulse-dot",
        )}
        aria-hidden
      />
      {status.label}
    </span>
  );
}
