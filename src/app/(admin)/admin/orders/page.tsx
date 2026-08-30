import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { listAllOrders } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Orders · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await listAllOrders();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Every order across the platform. Status changes are audited and notify the customer."
      />
      <SetupNotice what="order records" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminOrdersTable orders={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
