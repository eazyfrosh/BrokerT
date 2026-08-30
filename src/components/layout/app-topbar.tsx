import { MobileSidebar } from "./mobile-sidebar";
import { SearchCommand } from "./search-command";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DemoBadge } from "@/components/shared/demo-notices";
import { Logo } from "@/components/shared/logo";
import type { NavGroup } from "@/lib/navigation";
import type { AppNotification, Profile } from "@/types/database";

interface AppTopbarProps {
  profile: Profile;
  isAdmin: boolean;
  unreadCount: number;
  notifications: AppNotification[];
  navGroups?: NavGroup[];
  /** Optional greeting or breadcrumb rendered on wide screens. */
  greeting?: React.ReactNode;
}

export function AppTopbar({
  profile,
  isAdmin,
  unreadCount,
  notifications,
  navGroups,
  greeting,
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="flex h-15 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <MobileSidebar groups={navGroups} isAdmin={isAdmin} />
        <Logo className="lg:hidden" showWordmark={false} />

        <div className="hidden min-w-0 flex-1 lg:block">{greeting}</div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <SearchCommand />
          </div>
          <DemoBadge className="hidden md:inline-flex" label="Demo" />
          <ThemeToggle />
          <NotificationBell
            userId={profile.id}
            initialUnread={unreadCount}
            initialItems={notifications}
          />
          <UserMenu profile={profile} isAdmin={isAdmin} />
        </div>
      </div>

      {/* Search gets its own row on small screens rather than being dropped. */}
      <div className="border-t border-border px-4 py-2 sm:hidden">
        <SearchCommand />
      </div>
    </header>
  );
}
