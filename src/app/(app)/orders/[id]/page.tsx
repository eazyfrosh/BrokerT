import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { CancelOrderButton } from "@/components/orders/cancel-order-button";
import { getMyOrder, isCancellable } from "@/lib/services/orders";
import { formatCurrency, formatDateTime, formatQuantity, titleCase } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getMyOrder(id);
  return { title: result ? `Order ${result.order.reference}` : "Order" };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/orders/${id}`);

  const result = await getMyOrder(id);
  if (!result) notFound();

  const { order, fills } = result;
  const referencePrice = order.average_fill_price ?? order.limit_price ?? order.estimated_price;
  const total = Number(order.quantity) * Number(referencePrice ?? 0);

  const details: [string, React.ReactNode][] = [
    ["Instrument", `${order.assets?.symbol ?? "—"} · ${order.assets?.name ?? ""}`],
    ["Side", <span key="side" className={order.side === "buy" ? "text-gain" : "text-loss"}>{titleCase(order.side)}</span>],
    ["Order type", titleCase(order.order_type)],
    ["Time in force", order.time_in_force.toUpperCase()],
    ["Quantity", formatQuantity(order.quantity)],
    ["Filled quantity", formatQuantity(order.filled_quantity)],
    ...(order.limit_price ? ([["Limit price", formatCurrency(order.limit_price)]] as [string, React.ReactNode][]) : []),
    ...(order.stop_price ? ([["Stop price", formatCurrency(order.stop_price)]] as [string, React.ReactNode][]) : []),
    ["Estimated price", formatCurrency(order.estimated_price)],
    ["Average fill price", formatCurrency(order.average_fill_price)],
    ["Fees", formatCurrency(order.fees)],
    ["Total", formatCurrency(total)],
  ];

  const timeline: [string, string | null][] = [
    ["Created", order.created_at],
    ["Submitted", order.submitted_at],
    ["Filled", order.filled_at],
    ["Cancelled", order.cancelled_at],
  ];

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/orders">
          <ArrowLeft /> All orders
        </Link>
      </Button>

      <PageHeader
        title={`Order ${order.reference}`}
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <CopyButton value={order.reference} label="Copy order reference" />
            {isCancellable(order.status) && (
              <CancelOrderButton orderId={order.id} reference={order.reference} />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge status={order.status} />
          {order.is_simulated && <Badge variant="warning">Simulated</Badge>}
        </div>
      </PageHeader>

      {order.status === "rejected" && order.rejection_reason && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
          <p className="text-sm font-medium">This order was rejected</p>
          <p className="mt-1 text-sm text-muted-foreground">{order.rejection_reason}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order detail</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {timeline
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <li key={label} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(value)}</p>
                    </div>
                  </li>
                ))}
            </ol>

            <Separator className="my-4" />

            <h3 className="text-sm font-semibold">Fills</h3>
            {fills.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No fills recorded yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {fills.map((fill) => (
                  <li key={fill.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="tabular">{formatQuantity(fill.quantity)} @ {formatCurrency(fill.price)}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(fill.filled_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        This order was executed against the demo market engine. No real securities were bought or sold.
      </p>
    </div>
  );
}
