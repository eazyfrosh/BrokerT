import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminTransactionsTable } from "@/components/admin/admin-transactions-table";
import { listAllTransactions } from "@/lib/services/admin";
import { formatCurrency, formatNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Deposits · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  await requireAdmin();
  const deposits = await listAllTransactions(["deposit"]);
  const total = deposits.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        description="Simulated funding recorded against customer accounts."
      />
      <SetupNotice what="deposit records" />

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Deposits recorded" value={formatNumber(deposits.length, 0)} />
        <StatCard label="Simulated value" value={formatCurrency(total)} hint="Demo mode — no real funds" />
      </section>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminTransactionsTable transactions={deposits} showFilters={false} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Deposits in demo mode are simulated and involve no payment rail. The database function behind
        them refuses to run once demo mode is switched off.
      </p>
    </div>
  );
}
