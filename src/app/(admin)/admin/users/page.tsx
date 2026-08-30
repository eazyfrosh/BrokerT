import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { listAllProfiles } from "@/lib/services/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const profiles = await listAllProfiles();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Every account on the platform, with its status, role and verification state."
      />
      <SetupNotice what="user records" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <AdminUsersTable profiles={profiles} />
        </CardContent>
      </Card>
    </div>
  );
}
