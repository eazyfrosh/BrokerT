import type { Metadata } from "next";
import Link from "next/link";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { VehicleVisual, variantForSlug } from "@/components/cars/vehicle-visual";
import { listMyCarOrders } from "@/lib/services/vehicles";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Vehicle order requests" };
export const dynamic = "force-dynamic";

export default async function CarOrdersPage() {
  await requireSession("/car-orders");
  const orders = await listMyCarOrders();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicle order requests"
        description="Configurations you have submitted, with their current stage."
        actions={
          <Button asChild>
            <Link href="/cars">
              <Car /> Configure a vehicle
            </Link>
          </Button>
        }
      />

      <SetupNotice what="your order requests" />

      {orders.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No order requests yet"
          description="Build a configuration in the marketplace and submit it to see it tracked here."
          action={
            <Button asChild size="sm">
              <Link href="/cars">Browse vehicles</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <Link href={`/car-orders/${order.id}`} className="block transition-colors hover:bg-muted/30">
                <div className="bg-muted/50 px-4 pt-3 text-foreground">
                  <VehicleVisual
                    variant={variantForSlug(order.vehicles?.slug ?? "model-3")}
                    className="max-h-28"
                  />
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">
                        {order.vehicles?.model_name ?? "Vehicle"}
                      </h2>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{order.reference}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  {order.configuration_summary && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {order.configuration_summary}
                    </p>
                  )}

                  <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Total</dt>
                      <dd className="mt-0.5 font-semibold tabular">
                        {formatCurrency(Number(order.total_price), { decimals: 0 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Requested</dt>
                      <dd className="mt-0.5 font-medium tabular">{formatDate(order.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Indicative delivery</dt>
                      <dd className="mt-0.5 font-medium tabular">{formatDate(order.estimated_delivery)}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Demo</Badge>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These are simulated order requests in an independent marketplace. No payment has been taken and
          no vehicle has been reserved.
        </p>
      </div>
    </div>
  );
}
