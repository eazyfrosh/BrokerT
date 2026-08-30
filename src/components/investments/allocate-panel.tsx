"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { allocateInvestmentAction, type AllocationReceipt } from "@/lib/actions/investments";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { round } from "@/lib/utils";
import type { Investment } from "@/types/database";

interface AllocatePanelProps {
  investment: Investment;
  availableCash: number;
  signedIn: boolean;
  accountActive: boolean;
}

export function AllocatePanel({ investment, availableCash, signedIn, accountActive }: AllocatePanelProps) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<AllocationReceipt | null>(null);

  const minimum = Number(investment.minimum_amount);
  const maximum = investment.maximum_amount === null ? null : Number(investment.maximum_amount);
  const numeric = Number(amount);
  const valid = Number.isFinite(numeric) && numeric > 0;

  const remainingCapacity =
    investment.capacity_amount === null
      ? null
      : Math.max(round(Number(investment.capacity_amount) - Number(investment.raised_amount), 2), 0);

  const problems: string[] = [];
  if (amount.trim()) {
    if (!valid) problems.push("Enter a valid amount.");
    else {
      if (numeric < minimum) problems.push(`The minimum allocation is ${formatCurrency(minimum)}.`);
      if (maximum !== null && numeric > maximum) {
        problems.push(`The maximum allocation is ${formatCurrency(maximum)}.`);
      }
      if (numeric > availableCash) problems.push("You do not have enough available cash.");
      if (remainingCapacity !== null && numeric > remainingCapacity) {
        problems.push(`Only ${formatCurrency(remainingCapacity)} of capacity remains.`);
      }
    }
  }

  const projected = valid ? round(numeric * (1 + Number(investment.target_return_pct) / 100), 2) : 0;
  const canReview =
    signedIn && accountActive && investment.status === "open" && valid && problems.length === 0;

  async function submit() {
    setSubmitting(true);
    setError(null);

    const result = await allocateInvestmentAction({
      investmentId: investment.id,
      amount: numeric,
      acknowledgeRisk: true,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReviewOpen(false);
    setReceipt(result.data);
    setAmount("");
    setAcknowledged(false);
    router.refresh();
    toast.success("Allocation confirmed", { description: `Reference ${result.data.reference}` });
  }

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in to allocate to this strategy. Demo accounts use simulated balances.
        </p>
        <Button asChild className="w-full">
          <Link href={`/login?next=/investments/${investment.slug}`}>Sign in to allocate</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/register">Create an account</Link>
        </Button>
      </div>
    );
  }

  if (investment.status !== "open") {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        This strategy is not accepting new allocations.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="allocation-amount">Amount</Label>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              disabled={availableCash < minimum}
              onClick={() => {
                const cap = [availableCash, maximum ?? Infinity, remainingCapacity ?? Infinity];
                setAmount(String(round(Math.min(...cap), 2)));
              }}
            >
              Max {formatCurrency(availableCash, { decimals: 0 })}
            </button>
          </div>
          <Input
            id="allocation-amount"
            inputMode="decimal"
            placeholder={String(minimum)}
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            aria-invalid={problems.length > 0}
            className="tabular"
          />
          <p className="text-xs text-muted-foreground">
            Minimum {formatCurrency(minimum)}
            {maximum !== null && ` · Maximum ${formatCurrency(maximum)}`}
          </p>
        </div>

        <Separator />

        <dl className="space-y-2 text-sm">
          {[
            ["Available cash", formatCurrency(availableCash)],
            ["Target return", formatPercent(Number(investment.target_return_pct), { signed: false })],
            ["Term", `${investment.duration_months} months`],
            ["Management fee", formatPercent(Number(investment.management_fee_pct), { signed: false })],
            ...(Number(investment.performance_fee_pct) > 0
              ? ([["Performance fee", formatPercent(Number(investment.performance_fee_pct), { signed: false })]] as [string, string][])
              : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular">{value}</dd>
            </div>
          ))}
        </dl>

        {valid && problems.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Illustrative value at target date</p>
            <p className="mt-0.5 text-lg font-semibold tabular">{formatCurrency(projected)}</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
              A projection only, assuming the target return is achieved. It is not a guarantee and the
              actual outcome may be lower, including a loss of principal.
            </p>
          </div>
        )}

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
            Your account is not active, so allocations cannot be made.
          </p>
        )}

        <Button className="w-full" size="lg" disabled={!canReview} onClick={() => setReviewOpen(true)}>
          Review investment
        </Button>
      </div>

      {/* Confirmation ------------------------------------------------- */}
      <Dialog open={reviewOpen} onOpenChange={(open) => !submitting && setReviewOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review your allocation</DialogTitle>
            <DialogDescription>
              Confirm the details and the risk disclosure before your cash is allocated.
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border rounded-lg border border-border">
            {[
              ["Strategy", investment.name],
              ["Risk level", investment.risk_level],
              ["Amount", formatCurrency(numeric)],
              ["Term", `${investment.duration_months} months`],
              ["Target return", formatPercent(Number(investment.target_return_pct), { signed: false })],
              ["Illustrative value at target", formatCurrency(projected)],
              ["Cash after", formatCurrency(round(availableCash - numeric, 2))],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium capitalize tabular">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground scrollbar-thin">
            <p className="font-medium text-foreground">Risk disclosure</p>
            <p className="mt-1">{investment.risk_disclosure}</p>
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="acknowledge-risk"
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
              className="mt-0.5"
            />
            <Label htmlFor="acknowledge-risk" className="text-sm font-normal leading-relaxed text-muted-foreground">
              I have read the risk disclosure and understand the target return is an illustrative
              projection, not a guarantee, and that I may lose money.
            </Label>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={submitting}>
              Back
            </Button>
            <Button loading={submitting} disabled={!acknowledged} onClick={submit}>
              Confirm allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt ------------------------------------------------------ */}
      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          {receipt && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-success/12 text-success">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </span>
                  <DialogTitle>Allocation confirmed</DialogTitle>
                </div>
                <DialogDescription>
                  {formatCurrency(receipt.principal)} has been allocated to {receipt.investmentName}.
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {[
                  ["Reference", receipt.reference],
                  ["Principal", formatCurrency(receipt.principal)],
                  ["Target date", formatDate(receipt.targetDate)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReceipt(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href={`/investments/active/${receipt.id}`}>View allocation</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
