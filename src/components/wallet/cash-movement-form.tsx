"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { demoCashMovementAction, type CashMovementReceipt } from "@/lib/actions/wallet";
import { formatCurrency } from "@/lib/format";
import { cn, round } from "@/lib/utils";

const PRESETS = [500, 1000, 5000, 25000];

export function CashMovementForm({
  type,
  availableBalance,
  demoMode,
  accountActive,
}: {
  type: "deposit" | "withdrawal";
  availableBalance: number;
  demoMode: boolean;
  accountActive: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<CashMovementReceipt | null>(null);

  const numeric = Number(amount);
  const valid = Number.isFinite(numeric) && numeric > 0;

  const problems: string[] = [];
  if (amount.trim()) {
    if (!valid) problems.push("Enter a valid amount.");
    else {
      if (numeric > 1_000_000) problems.push("The demo limit is $1,000,000 per movement.");
      if (type === "withdrawal" && numeric > availableBalance) {
        problems.push("That is more than your available balance.");
      }
    }
  }

  const canSubmit = demoMode && accountActive && valid && problems.length === 0;

  async function submit() {
    setSubmitting(true);
    setError(null);

    const result = await demoCashMovementAction({ type, amount: numeric, method: "demo" });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmOpen(false);
    setReceipt(result.data);
    setAmount("");
    router.refresh();
    toast.success(type === "deposit" ? "Simulated funds added" : "Simulated withdrawal recorded", {
      description: `Reference ${result.data.reference}`,
    });
  }

  if (!demoMode) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">Funding is not available</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Demo mode is switched off and no payment provider is connected, so balances cannot be changed.
          Connect a regulated payment provider to enable real funding.
        </p>
      </div>
    );
  }

  const balanceAfter = valid
    ? round(type === "deposit" ? availableBalance + numeric : availableBalance - numeric, 2)
    : availableBalance;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/8 p-3.5">
          <Badge variant="warning" className="shrink-0">Demo</Badge>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {type === "deposit"
              ? "This adds simulated cash to your demo balance. No real money is received, no payment method is charged, and nothing is transferred."
              : "This removes simulated cash from your demo balance. No real money is sent and no payout is made to any account."}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${type}-amount`}>Amount</Label>
            <span className="text-xs tabular text-muted-foreground">
              Available {formatCurrency(availableBalance)}
            </span>
          </div>
          <Input
            id={`${type}-amount`}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            aria-invalid={problems.length > 0}
            className="tabular text-lg"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.filter((preset) => type === "deposit" || preset <= availableBalance).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={cn(
                "rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {formatCurrency(preset, { decimals: 0 })}
            </button>
          ))}
          {type === "withdrawal" && availableBalance > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(round(availableBalance, 2)))}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40"
            >
              All
            </button>
          )}
        </div>

        {problems.length > 0 && (
          <ul className="space-y-1" role="alert">
            {problems.map((problem) => (
              <li key={problem} className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                {problem}
              </li>
            ))}
          </ul>
        )}

        {!accountActive && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            Your account is not active, so balances cannot be changed.
          </p>
        )}

        <Separator />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Balance now</dt>
            <dd className="tabular">{formatCurrency(availableBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Balance after</dt>
            <dd className="font-semibold tabular">{formatCurrency(balanceAfter)}</dd>
          </div>
        </dl>

        <Button className="w-full" size="lg" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
          {type === "deposit" ? "Add simulated funds" : "Record simulated withdrawal"}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {type === "deposit" ? "Add simulated funds?" : "Record a simulated withdrawal?"}
            </DialogTitle>
            <DialogDescription>
              {type === "deposit"
                ? "This adds simulated cash to your demo balance only. No real money will be received and no payment method will be charged."
                : "This removes simulated cash from your demo balance only. No real money will be sent to any account."}
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border rounded-lg border border-border">
            {[
              ["Amount", formatCurrency(numeric)],
              ["Balance now", formatCurrency(availableBalance)],
              ["Balance after", formatCurrency(balanceAfter)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular">{value}</dd>
              </div>
            ))}
          </dl>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={submit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          {receipt && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-success/12 text-success">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </span>
                  <DialogTitle>Simulated movement recorded</DialogTitle>
                </div>
                <DialogDescription>
                  Your demo balance has been updated. No real money moved.
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {[
                  ["Reference", receipt.reference],
                  ["Type", receipt.type === "deposit" ? "Simulated deposit" : "Simulated withdrawal"],
                  ["Amount", formatCurrency(receipt.amount)],
                  ["Balance after", formatCurrency(receipt.balanceAfter ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              <DialogFooter>
                <Button onClick={() => setReceipt(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
