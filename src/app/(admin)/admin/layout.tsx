import { ShieldCheck } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileSidebar } from "@/components/admin/admin-mobile-sidebar";
import { SearchCommand } from "@/components/layout/search-command";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { displayName } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="flex h-15 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <AdminMobileSidebar />
            <Logo href="/admin" className="lg:hidden" showWordmark={false} />

            <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
              <ShieldCheck className="size-4 shrink-0 text-warning" aria-hidden />
              <p className="truncate text-sm font-semibold">
                Admin console — signed in as {displayName(session.profile)}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="hidden sm:block">
                <SearchCommand />
              </div>
              <Badge variant="warning" className="hidden md:inline-flex">
                {session.profile.role === "super_admin" ? "Super admin" : "Admin"}
              </Badge>
              <ThemeToggle />
              <UserMenu profile={session.profile} isAdmin />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
