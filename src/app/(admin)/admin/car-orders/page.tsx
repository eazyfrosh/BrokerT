import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminCarOrdersTable } from "@/components/admin/admin-car-orders-table";
import { listAllCarOrders } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Vehicle orders · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCarOrdersPage() {
  await requireAdmin();
  const orders = await listAllCarOrders();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicle order requests"
        description="Configurations customers have submitted, with their stage and internal notes."
      />
      <SetupNotice what="vehicle order requests" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminCarOrdersTable orders={orders} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        These are simulated requests in an independent demo marketplace. Advancing a stage is a
        demonstration only — nothing is ordered from, or communicated to, any manufacturer or dealer.
      </p>
    </div>
  );
}
