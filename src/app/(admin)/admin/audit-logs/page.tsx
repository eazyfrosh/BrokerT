import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { listAuditLogs } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Audit log · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  await requireAdmin();
  const logs = await listAuditLogs();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every administrative change, with who made it and when."
      />

      <Alert variant="info">
        <Lock />
        <AlertTitle>Append-only</AlertTitle>
        <AlertDescription>
          Audit entries are written by the database functions that perform each administrative change.
          A trigger rejects every UPDATE and DELETE on this table, so no administrator — including a
          super administrator — can edit or remove an entry through the application.
        </AlertDescription>
      </Alert>

      <SetupNotice what="audit entries" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AuditLogTable logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
