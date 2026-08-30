import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminTransactionsTable } from "@/components/admin/admin-transactions-table";
import { listAllTransactions } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Transactions · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  await requireAdmin();
  const transactions = await listAllTransactions();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Deposits, withdrawals, trades, allocations and fees across every account."
      />
      <SetupNotice what="transaction records" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminTransactionsTable transactions={transactions} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ledger entries are written only by the database functions behind trading, allocation and demo
        funding. They cannot be created or edited directly from this console.
      </p>
    </div>
  );
}
