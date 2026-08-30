import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { RiskAlert } from "@/components/shared/demo-notices";
import { InvestmentCard } from "@/components/investments/investment-card";
import { listBrowsableInvestments } from "@/lib/services/investments";
import { getSessionContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Investment strategies",
  description:
    "Thematic investment strategies with their objective, term, minimum and risk stated up front. Target returns are illustrative projections, not guarantees.",
};
export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [investments, session] = await Promise.all([listBrowsableInvestments(), getSessionContext()]);
  const inApp = Boolean(session);

  const open = investments.filter((item) => item.status === "open");
  const other = investments.filter((item) => item.status !== "open");

  return (
    <div className={inApp ? "space-y-6" : "mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"}>
      <PageHeader
        title="Investment strategies"
        description="Each strategy states what it is trying to do and what could go wrong before it states a target."
        actions={
          session && (
            <Button asChild variant="outline">
              <Link href="/investments/active">
                <BadgeCheck /> My allocations
              </Link>
            </Button>
          )
        }
      />

      <RiskAlert />
      <SetupNotice what="investment strategies" />

      {investments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No strategies published"
          description="Investment strategies appear here once they are published by the platform team."
        />
      ) : (
        <>
          <section aria-label="Open strategies" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {open.map((investment) => (
              <InvestmentCard key={investment.id} investment={investment} />
            ))}
          </section>

          {other.length > 0 && (
            <section aria-label="Closed strategies" className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Not accepting allocations
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {other.map((investment) => (
                  <InvestmentCard key={investment.id} investment={investment} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        All performance figures on this page are simulated. Target returns are illustrative projections
        based on that simulated performance and are not promises of future results. Diversification does
        not assure a profit or protect against loss. Read the{" "}
        <Link href="/risk-disclosure" className="font-medium text-primary hover:underline">
          full risk disclosure
        </Link>{" "}
        before allocating.
      </p>
    </div>
  );
}
