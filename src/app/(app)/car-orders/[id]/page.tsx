import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CopyButton } from "@/components/shared/copy-button";
import { CarOrderTimeline } from "@/components/cars/car-order-timeline";
import { CancelCarOrderButton } from "@/components/cars/cancel-car-order-button";
import { VehicleVisual, variantForSlug } from "@/components/cars/vehicle-visual";
import { getMyCarOrder } from "@/lib/services/vehicles";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CANCELLABLE = new Set(["configuration", "order_request", "processing"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getMyCarOrder(id);
  return { title: order ? `Order request ${order.reference}` : "Order request" };
}

export default async function CarOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/car-orders/${id}`);

  const order = await getMyCarOrder(id);
  if (!order) notFound();

  const address = [
    order.delivery_address_line1,
    order.delivery_address_line2,
    order.delivery_city,
    order.delivery_region,
    order.delivery_postal_code,
    order.delivery_country,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/car-orders">
          <ArrowLeft /> All order requests
        </Link>
      </Button>

      <PageHeader
        title={order.vehicles?.model_name ?? "Vehicle order request"}
        description={`Requested ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <CopyButton value={order.reference} label="Copy request reference" />
            {CANCELLABLE.has(order.status) && (
              <CancelCarOrderButton orderId={order.id} reference={order.reference} />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="font-mono text-xs text-muted-foreground">{order.reference}</span>
          <StatusBadge status={order.status} />
          {order.is_simulated && <Badge variant="warning">Simulated</Badge>}
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-6 pt-5 text-foreground">
              <VehicleVisual
                variant={variantForSlug(order.vehicles?.slug ?? "model-3")}
                className="max-h-44"
              />
            </div>
            <CardContent className="p-5">
              <dl className="divide-y divide-border">
                {[
                  ["Model", order.vehicles?.model_name ?? "—"],
                  ["Configuration", order.configuration_summary ?? "—"],
                  ["Estimated total", formatCurrency(Number(order.total_price), { decimals: 0 })],
                  ["Deposit taken", formatCurrency(Number(order.deposit_amount))],
                  ["Indicative delivery", formatDate(order.estimated_delivery)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Recipient</dt>
                  <dd className="mt-0.5 font-medium">{order.delivery_full_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contact</dt>
                  <dd className="mt-0.5">
                    {order.delivery_email ?? "—"}
                    {order.delivery_phone && <> · {order.delivery_phone}</>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
                  <dd className="mt-0.5 whitespace-pre-line">
                    {address.length ? address.join("\n") : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CarOrderTimeline status={order.status} />
            <p className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed">
              <strong className="font-medium">Simulated request.</strong> Stages are advanced by the
              platform team for demonstration. No payment has been taken, no vehicle has been reserved,
              and nothing has been sent to a manufacturer or dealer.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
