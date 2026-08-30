import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { InvestmentForm } from "@/components/admin/investment-form";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import type { Investment } from "@/types/database";

export const dynamic = "force-dynamic";

async function getInvestment(id: string): Promise<Investment | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("investments").select("*").eq("id", id).maybeSingle<Investment>();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const investment = await getInvestment(id);
  return { title: investment ? `${investment.name} · Admin` : "Strategy · Admin" };
}

export default async function EditInvestmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();

  const investment = await getInvestment(id);
  if (!investment) notFound();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/investments">
          <ArrowLeft /> All strategies
        </Link>
      </Button>

      <PageHeader title={investment.name} description={`Created ${formatDate(investment.created_at)}`}>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge status={investment.status} />
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href={`/investments/${investment.slug}`}>View the customer page</Link>
          </Button>
        </div>
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Allocated" value={formatCurrency(Number(investment.raised_amount))} />
        <StatCard
          label="Capacity"
          value={
            investment.capacity_amount === null
              ? "Uncapped"
              : formatCurrency(Number(investment.capacity_amount))
          }
        />
        <StatCard label="Minimum" value={formatCurrency(Number(investment.minimum_amount))} />
      </section>

      <Card>
        <CardContent className="p-5">
          <InvestmentForm investment={investment} />
        </CardContent>
      </Card>
    </div>
  );
}
