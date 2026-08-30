import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type { CarOrderStatus } from "@/types/database";

/** The happy path, in order. `cancelled` is handled separately. */
const FLOW: CarOrderStatus[] = [
  "configuration",
  "order_request",
  "processing",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

const DESCRIPTIONS: Record<CarOrderStatus, string> = {
  configuration: "Configuration saved",
  order_request: "Request received and queued for review",
  processing: "Request being reviewed",
  confirmed: "Request confirmed",
  preparing: "Preparation under way",
  ready: "Ready for handover",
  completed: "Request completed",
  cancelled: "Request cancelled",
};

export function CarOrderTimeline({
  status,
  className,
}: {
  status: CarOrderStatus;
  className?: string;
}) {
  if (status === "cancelled") {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/40 p-4", className)}>
        <p className="text-sm font-medium">Request cancelled</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This order request was cancelled and is no longer progressing.
        </p>
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(status);

  return (
    <ol className={cn("relative space-y-0", className)}>
      {FLOW.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const isLast = index === FLOW.length - 1;

        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector */}
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[0.6875rem] top-6 h-full w-px",
                  done ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}

            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 bg-card",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary",
                !done && !active && "border-border",
              )}
              aria-hidden
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : active ? (
                <span className="size-2 rounded-full bg-primary" />
              ) : null}
            </span>

            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {titleCase(step)}
                {active && (
                  <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary">
                    Current
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{DESCRIPTIONS[step]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
