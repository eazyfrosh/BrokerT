"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useLiveQuote } from "@/hooks/use-live-quote";
import { estimateOrder, maxAffordableQuantity } from "@/lib/calculations/orders";
import { placeOrderAction, type PlacedOrder } from "@/lib/actions/orders";
import { formatCurrency, formatQuantity, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/market/types";
import type { OrderSide, OrderType, TimeInForce } from "@/types/database";

const ORDER_TYPES: { value: OrderType; label: string; hint: string }[] = [
  { value: "market", label: "Market", hint: "Fills immediately at the prevailing price." },
  { value: "limit", label: "Limit", hint: "Fills only at your price or better." },
  { value: "stop", label: "Stop", hint: "Becomes a market order once the stop price trades." },
  { value: "stop_limit", label: "Stop limit", hint: "Becomes a limit order once the stop price trades." },
];

const TIF: { value: TimeInForce; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "gtc", label: "Good till cancelled" },
  { value: "ioc", label: "Immediate or cancel" },
  { value: "fok", label: "Fill or kill" },
];

interface OrderTicketProps {
  assetId: string;
  initialQuote: Quote;
  availableCash: number;
  positionQuantity: number;
  averageCost: number;
  accountActive: boolean;
}

export function OrderTicket({
  assetId,
  initialQuote,
  availableCash,
  positionQuantity,
  averageCost,
  accountActive,
}: OrderTicketProps) {
  const router = useRouter();
  const { quote } = useLiveQuote(initialQuote, 5000);

  const [side, setSide] = React.useState<OrderSide>("buy");
  const [orderType, setOrderType] = React.useState<OrderType>("market");
  const [timeInForce, setTimeInForce] = React.useState<TimeInForce>("day");
  const [quantity, setQuantity] = React.useState("");
  const [limitPrice, setLimitPrice] = React.useState("");
  const [stopPrice, setStopPrice] = React.useState("");

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [placed, setPlaced] = React.useState<PlacedOrder | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const numericQuantity = Number(quantity);
  const estimate = React.useMemo(
    () =>
      estimateOrder({
        side,
        orderType,
        quantity: Number.isFinite(numericQuantity) ? numericQuantity : 0,
        marketPrice: quote.price,
        limitPrice: limitPrice ? Number(limitPrice) : null,
        stopPrice: stopPrice ? Number(stopPrice) : null,
        availableCash,
        positionQuantity,
        averageCost,
      }),
    [side, orderType, numericQuantity, quote.price, limitPrice, stopPrice, availableCash, positionQuantity, averageCost],
  );

  const touched = quantity.trim().length > 0;
  const blocking = touched ? estimate.errors : [];
  const canPreview = accountActive && touched && numericQuantity > 0 && estimate.errors.length === 0;

  function resetTicket() {
    setQuantity("");
    setLimitPrice("");
    setStopPrice("");
    setServerError(null);
  }

  async function submit() {
    setSubmitting(true);
    setServerError(null);

    const result = await placeOrderAction({
      assetId,
      side,
      orderType,
      quantity: numericQuantity,
      limitPrice: limitPrice ? Number(limitPrice) : null,
      stopPrice: stopPrice ? Number(stopPrice) : null,
      timeInForce,
    });

    setSubmitting(false);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setPreviewOpen(false);
    setPlaced(result.data);
    resetTicket();
    router.refresh();
    toast.success(
      result.data.status === "filled" ? "Order filled" : "Order submitted",
      { description: `Reference ${result.data.reference}` },
    );
  }

  const maxQuantity =
    side === "buy" ? maxAffordableQuantity(availableCash, quote.price) : positionQuantity;

  return (
    <>
      <div className="space-y-4">
        {/* Side ------------------------------------------------------- */}
        <div role="group" aria-label="Order side" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["buy", "sell"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={side === value}
              onClick={() => setSide(value)}
              className={cn(
                "rounded-md py-2 text-sm font-semibold capitalize transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                side === value
                  ? value === "buy"
                    ? "bg-success text-success-foreground shadow-xs"
                    : "bg-destructive text-destructive-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Order type ------------------------------------------------- */}
        <div className="space-y-1.5">
          <Label htmlFor="order-type">Order type</Label>
          <Select value={orderType} onValueChange={(value) => setOrderType(value as OrderType)}>
            <SelectTrigger id="order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ORDER_TYPES.find((option) => option.value === orderType)?.hint}
          </p>
        </div>

        {/* Quantity --------------------------------------------------- */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="quantity">Quantity</Label>
            <button
              type="button"
              onClick={() => setQuantity(String(maxQuantity))}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              disabled={maxQuantity <= 0}
            >
              Max {formatQuantity(maxQuantity)}
            </button>
          </div>
          <Input
            id="quantity"
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.]/g, ""))}
            aria-invalid={blocking.length > 0}
            className="tabular"
          />
        </div>

        {/* Conditional prices ----------------------------------------- */}
        {(orderType === "limit" || orderType === "stop_limit") && (
          <div className="space-y-1.5">
            <Label htmlFor="limit-price">Limit price</Label>
            <Input
              id="limit-price"
              inputMode="decimal"
              placeholder={quote.price.toFixed(2)}
              value={limitPrice}
              onChange={(event) => setLimitPrice(event.target.value.replace(/[^0-9.]/g, ""))}
              className="tabular"
            />
          </div>
        )}

        {(orderType === "stop" || orderType === "stop_limit") && (
          <div className="space-y-1.5">
            <Label htmlFor="stop-price">Stop price</Label>
            <Input
              id="stop-price"
              inputMode="decimal"
              placeholder={quote.price.toFixed(2)}
              value={stopPrice}
              onChange={(event) => setStopPrice(event.target.value.replace(/[^0-9.]/g, ""))}
              className="tabular"
            />
          </div>
        )}

        {orderType !== "market" && (
          <div className="space-y-1.5">
            <Label htmlFor="tif">Time in force</Label>
            <Select value={timeInForce} onValueChange={(value) => setTimeInForce(value as TimeInForce)}>
              <SelectTrigger id="tif">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIF.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* Estimate --------------------------------------------------- */}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated price</dt>
            <dd className="tabular">{formatCurrency(estimate.referencePrice)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated total</dt>
            <dd className="font-semibold tabular">{formatCurrency(estimate.notional)}</dd>
          </div>
          {estimate.fees > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Fees</dt>
              <dd className="tabular">{formatCurrency(estimate.fees)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Available cash</dt>
            <dd className="tabular">{formatCurrency(availableCash)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Your position</dt>
            <dd className="tabular">{formatQuantity(positionQuantity)} {quote.symbol}</dd>
          </div>
        </dl>

        {blocking.length > 0 && (
          <ul className="space-y-1" role="alert">
            {blocking.map((message) => (
              <li key={message} className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                {message}
              </li>
            ))}
          </ul>
        )}

        {touched && blocking.length === 0 && estimate.warnings.length > 0 && (
          <ul className="space-y-1">
            {estimate.warnings.map((message) => (
              <li key={message} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                {message}
              </li>
            ))}
          </ul>
        )}

        {!accountActive && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            Your account is not active, so orders cannot be placed. Contact support for help.
          </p>
        )}

        <Button
          className="w-full"
          size="lg"
          variant={side === "buy" ? "success" : "destructive"}
          disabled={!canPreview}
          onClick={() => setPreviewOpen(true)}
        >
          Preview order
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Demo order. No real securities are bought or sold.
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Confirmation                                                   */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={previewOpen} onOpenChange={(open) => !submitting && setPreviewOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your order</DialogTitle>
            <DialogDescription>
              Check the details below. The final fill price is set by the market at execution and may
              differ from this estimate.
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y divide-border rounded-lg border border-border">
            {[
              ["Instrument", `${quote.symbol} · ${quote.name}`],
              ["Side", titleCase(side)],
              ["Order type", ORDER_TYPES.find((o) => o.value === orderType)?.label ?? ""],
              ["Quantity", formatQuantity(numericQuantity)],
              ...(orderType === "limit" || orderType === "stop_limit"
                ? [["Limit price", formatCurrency(Number(limitPrice))] as [string, string]]
                : []),
              ...(orderType === "stop" || orderType === "stop_limit"
                ? [["Stop price", formatCurrency(Number(stopPrice))] as [string, string]]
                : []),
              ["Estimated price", formatCurrency(estimate.referencePrice)],
              ...(estimate.fees > 0
                ? [["Fees", formatCurrency(estimate.fees)] as [string, string]]
                : []),
              ["Estimated total", formatCurrency(estimate.total)],
              ["Cash after", formatCurrency(estimate.cashAfter)],
              ["Position after", `${formatQuantity(estimate.positionAfter)} ${quote.symbol}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular">{value}</dd>
              </div>
            ))}
          </dl>

          {!estimate.marketable && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              This order is not marketable at the current price and will rest until your price is reached.
            </p>
          )}

          {serverError && (
            <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={submitting}>
              Back
            </Button>
            <Button
              variant={side === "buy" ? "success" : "destructive"}
              loading={submitting}
              onClick={submit}
            >
              Place demo order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* Receipt                                                        */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={Boolean(placed)} onOpenChange={(open) => !open && setPlaced(null)}>
        <DialogContent className="sm:max-w-md">
          {placed && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-success/12 text-success">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </span>
                  <DialogTitle>
                    {placed.status === "filled" ? "Order filled" : "Order submitted"}
                  </DialogTitle>
                </div>
                <DialogDescription>
                  {placed.status === "filled"
                    ? "Your holding, cash balance and transaction history have been updated."
                    : "Your order is working and will fill when the market reaches your price."}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Order reference</p>
                    <p className="truncate font-mono text-sm font-semibold">{placed.reference}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy reference"
                    onClick={() => {
                      void navigator.clipboard.writeText(placed.reference);
                      toast.success("Reference copied");
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
                <dl className="divide-y divide-border">
                  {[
                    ["Instrument", placed.symbol],
                    ["Side", titleCase(placed.side)],
                    ["Quantity", formatQuantity(placed.quantity)],
                    [
                      placed.status === "filled" ? "Fill price" : "Reference price",
                      formatCurrency(placed.averageFillPrice ?? placed.estimatedPrice),
                    ],
                    ...(placed.fees > 0
                      ? [["Fees", formatCurrency(placed.fees)] as [string, string]]
                      : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="warning">Simulated</Badge>
                <p className="text-xs text-muted-foreground">
                  This was a demo order. No real securities changed hands.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPlaced(null)}>
                  Place another
                </Button>
                <Button asChild>
                  <Link href={`/orders/${placed.id}`}>View order</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
