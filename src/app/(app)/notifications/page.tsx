import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { NotificationsList } from "@/components/shared/notifications-list";
import { listNotifications } from "@/lib/services/notifications";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireSession("/notifications");
  const notifications = await listNotifications(200);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Everything the platform has told you, kept on your account."
      />
      <SetupNotice what="your notifications" />
      <NotificationsList notifications={notifications} />
    </div>
  );
}
