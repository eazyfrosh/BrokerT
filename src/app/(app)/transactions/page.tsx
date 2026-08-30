import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { listMyTransactions } from "@/lib/services/transactions";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  await requireSession("/transactions");
  const transactions = await listMyTransactions();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="The full ledger: trades, allocations, fees and cash movements, each with its own reference."
      />

      <SetupNotice what="your transactions" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <TransactionsTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
