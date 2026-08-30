import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Receipt, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { DemoModeAlert } from "@/components/shared/demo-notices";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { getPortfolio } from "@/lib/services/portfolio";
import { listMyTransactions } from "@/lib/services/transactions";
import { formatCurrency } from "@/lib/format";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  await requireSession("/wallet");
  const [portfolio, transactions] = await Promise.all([getPortfolio(), listMyTransactions({ limit: 50 })]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wallet"
        description="Your cash position and the ledger behind it."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/withdrawals">
                <Receipt /> Withdraw
              </Link>
            </Button>
            <Button asChild>
              <Link href="/deposits">
                <Banknote /> Add funds
              </Link>
            </Button>
          </>
        }
      />

      <SetupNotice what="your wallet" />
      <DemoModeAlert />

      <section aria-label="Balances" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatCurrency(portfolio?.cashBalance ?? 0)}
          icon={WalletIcon}
          accent="primary"
          hint="Ready to trade or allocate"
        />
        <StatCard
          label="Reserved"
          value={formatCurrency(portfolio?.reservedBalance ?? 0)}
          hint="Held against working orders"
        />
        <StatCard
          label="Invested"
          value={formatCurrency((portfolio?.holdingsValue ?? 0) + (portfolio?.investedValue ?? 0))}
          hint="Holdings and strategy allocations"
        />
        <StatCard
          label="Total account value"
          value={formatCurrency(portfolio?.totalValue ?? 0)}
          hint="Cash plus everything invested"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        BrokerT is not a bank, a money transmitter or a payment institution, and does not hold client
        money. Balances shown here are simulated records inside this application.
      </p>
    </div>
  );
}
