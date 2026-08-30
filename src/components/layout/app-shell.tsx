import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Greeting } from "@/components/layout/greeting";
import { SidebarQuote } from "@/components/market/sidebar-quote";
import { isAdminRole } from "@/lib/auth";
import { listNotifications, countUnreadNotifications } from "@/lib/services/notifications";
import { getQuote } from "@/lib/services/market";
import { APP } from "@/lib/config";
import type { Profile } from "@/types/database";

/**
 * The signed-in application chrome. Shared by the private area and by the
 * routes that are also reachable while signed out, so a customer never drops
 * back to the marketing header mid-session.
 */
export async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [notifications, unreadCount, quote] = await Promise.all([
    listNotifications(12),
    countUnreadNotifications(),
    getQuote(),
  ]);

  const isAdmin = isAdminRole(profile.role);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar isAdmin={isAdmin} footer={quote ? <SidebarQuote quote={quote} /> : null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          profile={profile}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
          notifications={notifications}
          greeting={<Greeting profile={profile} subtitle={APP.demoNotice} />}
        />

        <main id="main" className="flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-8 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
