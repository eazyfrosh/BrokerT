import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { listAllProfiles } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const profiles = await listAllProfiles();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Send a message to every active customer, or to a chosen few."
      />
      <SetupNotice what="customer records" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastForm profiles={profiles} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Before you send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Notifications are written straight to each recipient&apos;s account and appear immediately in
              their notification centre. They cannot be recalled or edited afterwards.
            </p>
            <p>
              Never state or imply a guaranteed return, and never claim the platform is regulated,
              licensed or insured. Every broadcast is recorded in the audit log with your identity.
            </p>
            <p>
              Reserve the security-alert type for genuine account-security events — customers are asked
              to act on those immediately.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
