import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { KycSelect } from "@/components/admin/user-actions";
import { listAllProfiles } from "@/lib/services/admin";
import { formatDate, formatNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Verification · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  const session = await requireAdmin();
  const profiles = await listAllProfiles();

  const byStatus = {
    pending: profiles.filter((p) => p.kyc_status === "pending"),
    not_started: profiles.filter((p) => p.kyc_status === "not_started"),
    approved: profiles.filter((p) => p.kyc_status === "approved"),
    rejected: profiles.filter((p) => p.kyc_status === "rejected"),
  };

  const queue = [...byStatus.pending, ...byStatus.rejected];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Identity verification"
        description="Verification state per customer. Changes are audited and the customer is notified."
      />

      <SetupNotice what="verification records" />

      <Alert variant="info">
        <BadgeCheck />
        <AlertTitle>No documents are collected in demo mode</AlertTitle>
        <AlertDescription>
          This console records a verification decision only. A production deployment must collect and
          verify identity documents through a licensed provider, retain the evidence under its data
          policy, and complete that check before enabling funding or trading with real money.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending review" value={formatNumber(byStatus.pending.length, 0)} accent="primary" />
        <StatCard label="Not started" value={formatNumber(byStatus.not_started.length, 0)} />
        <StatCard label="Approved" value={formatNumber(byStatus.approved.length, 0)} accent="gain" />
        <StatCard label="Rejected" value={formatNumber(byStatus.rejected.length, 0)} accent="loss" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="Nothing awaiting review"
              description="Customers with a pending or rejected verification appear here."
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((profile) => (
                <li key={profile.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/users/${profile.id}`} className="text-sm font-medium hover:underline">
                      {[profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.email} · {profile.country ?? "Country not set"} · joined{" "}
                      {formatDate(profile.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={profile.kyc_status} />
                  {profile.id !== session.user.id && (
                    <div className="w-full sm:w-48">
                      <KycSelect userId={profile.id} status={profile.kyc_status} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>All customers</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/users">Open user management</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {profiles.slice(0, 20).map((profile) => (
              <li key={profile.id} className="flex items-center gap-3 py-2.5">
                <Link
                  href={`/admin/users/${profile.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {profile.email}
                </Link>
                <StatusBadge status={profile.kyc_status} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
