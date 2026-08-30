import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { InvestmentForm } from "@/components/admin/investment-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New strategy · Admin" };
export const dynamic = "force-dynamic";

export default async function NewInvestmentPage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/investments">
          <ArrowLeft /> All strategies
        </Link>
      </Button>

      <PageHeader
        title="New strategy"
        description="Strategies start as drafts and are invisible to customers until you set them open."
      />

      <Card>
        <CardContent className="p-5">
          <InvestmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
