import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { CashMovementForm } from "@/components/wallet/cash-movement-form";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { getMyWallet, listMyTransactions } from "@/lib/services/transactions";
import { requireSession } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";

export const metadata: Metadata = { title: "Deposits" };
export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const session = await requireSession("/deposits");
  const [wallet, transactions] = await Promise.all([
    getMyWallet(),
    listMyTransactions({ types: ["deposit"], limit: 50 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        description="Add simulated cash to your demo balance so you can trade and allocate."
      />

      <SetupNotice what="your wallet" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add funds</CardTitle>
          </CardHeader>
          <CardContent>
            <CashMovementForm
              type="deposit"
              availableBalance={Number(wallet?.available_balance ?? 0)}
              demoMode={DEMO_MODE}
              accountActive={session.profile.account_status === "active"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposit history</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsTable transactions={transactions} initialFilter="deposits" />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold">Connecting a real payment provider</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Demo funding exists only so the platform is usable without a payment integration. The database
          function behind it refuses to run when demo mode is switched off, so a production deployment
          must route funding through a regulated provider (Stripe, Paystack or a licensed banking
          partner) together with the identity verification and safeguarding obligations that come with
          holding client money.
        </p>
      </div>
    </div>
  );
}
