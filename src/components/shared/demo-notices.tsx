import { FlaskConical, Info, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { APP, DEMO_MODE } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Compact "DEMO MODE" pill for headers and chart corners. */
export function DemoBadge({ className, label = "Demo mode" }: { className?: string; label?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <Badge variant="warning" className={cn("gap-1", className)}>
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** "Simulated market data" marker shown wherever a price is displayed. */
export function SimulatedDataNotice({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium text-foreground">Demo market data.</strong> Prices are simulated
        and are not real-time market prices.
      </span>
    </p>
  );
}

/** Full-width demo-mode explainer for page tops. */
export function DemoModeAlert({ className }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <Alert variant="warning" className={className}>
      <FlaskConical />
      <AlertTitle>Demo mode</AlertTitle>
      <AlertDescription>{APP.demoNotice}</AlertDescription>
    </Alert>
  );
}

/** Standing risk warning, required on every page that shows returns. */
export function RiskNotice({ className, detail }: { className?: string; detail?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {APP.riskNotice} {detail}
    </p>
  );
}

export function RiskAlert({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Alert variant="default" className={className}>
      <ShieldAlert />
      <AlertTitle>Investing involves risk</AlertTitle>
      <AlertDescription>
        {children ?? (
          <>
            The value of investments can fall as well as rise and you may get back less than you put in.
            Past performance does not guarantee future results. Target returns are illustrative projections,
            not guarantees.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** The trademark separation notice. Rendered in every footer. */
export function TrademarkNotice({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{APP.trademarkNotice}</p>;
}
