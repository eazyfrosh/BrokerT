import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminInvestmentsTable } from "@/components/admin/admin-investments-table";
import { listAllInvestments } from "@/lib/services/investments";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Strategies · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminInvestmentsPage() {
  await requireAdmin();
  const investments = await listAllInvestments();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investment strategies"
        description="Create, edit, pause and archive the strategies customers can allocate to."
        actions={
          <Button asChild>
            <Link href="/admin/investments/new">
              <Plus /> New strategy
            </Link>
          </Button>
        }
      />
      <SetupNotice what="strategies" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminInvestmentsTable investments={investments} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Target returns are illustrative projections and must never be presented to customers as
        guaranteed. Every strategy requires a risk disclosure before it can be saved.
      </p>
    </div>
  );
}
