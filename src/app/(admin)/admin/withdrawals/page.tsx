import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminTransactionsTable } from "@/components/admin/admin-transactions-table";
import { listAllTransactions } from "@/lib/services/admin";
import { formatCurrency, formatNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Withdrawals · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const withdrawals = await listAllTransactions(["withdrawal"]);
  const total = withdrawals.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Withdrawals"
        description="Simulated withdrawals recorded against customer accounts."
      />
      <SetupNotice what="withdrawal records" />

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Withdrawals recorded" value={formatNumber(withdrawals.length, 0)} />
        <StatCard label="Simulated value" value={formatCurrency(total)} hint="Demo mode — no real payouts" />
      </section>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminTransactionsTable transactions={withdrawals} showFilters={false} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        No payout is initiated by a withdrawal in demo mode. Real withdrawals require a regulated payment
        provider, verified customer identity and appropriate safeguarding of client money.
      </p>
    </div>
  );
}
