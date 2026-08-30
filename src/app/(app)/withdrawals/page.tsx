import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { CashMovementForm } from "@/components/wallet/cash-movement-form";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { getMyWallet, listMyTransactions } from "@/lib/services/transactions";
import { requireSession } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";

export const metadata: Metadata = { title: "Withdrawals" };
export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const session = await requireSession("/withdrawals");
  const [wallet, transactions] = await Promise.all([
    getMyWallet(),
    listMyTransactions({ types: ["withdrawal"], limit: 50 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Withdrawals"
        description="Record a simulated withdrawal from your demo balance."
      />

      <SetupNotice what="your wallet" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Withdraw</CardTitle>
          </CardHeader>
          <CardContent>
            <CashMovementForm
              type="withdrawal"
              availableBalance={Number(wallet?.available_balance ?? 0)}
              demoMode={DEMO_MODE}
              accountActive={session.profile.account_status === "active"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawal history</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsTable transactions={transactions} initialFilter="withdrawals" />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold">No real payouts are made</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          A withdrawal here reduces a simulated balance inside this application. No funds leave any
          account, no payout is initiated, and no bank details are collected. Real withdrawals require a
          regulated payment provider, verified customer identity and appropriate safeguarding of client
          money.
        </p>
      </div>
    </div>
  );
}
