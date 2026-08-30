import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { OrdersTable } from "@/components/orders/orders-table";
import { listMyOrders } from "@/lib/services/orders";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireSession("/orders");
  const orders = await listMyOrders();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Every order you have placed, with its live status and fill detail."
        actions={
          <Button asChild>
            <Link href="/trade">
              <ArrowLeftRight /> New order
            </Link>
          </Button>
        }
      />

      <SetupNotice what="your orders" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <OrdersTable orders={orders} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Orders are executed against the demo market engine. No real securities are bought or sold, and
        no order is routed to any exchange or broker.
      </p>
    </div>
  );
}
