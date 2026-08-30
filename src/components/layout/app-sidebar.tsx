"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { DemoBadge } from "@/components/shared/demo-notices";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { APP_NAV, isNavItemActive, type NavGroup } from "@/lib/navigation";

interface AppSidebarProps {
  isAdmin?: boolean;
  groups?: NavGroup[];
  /** Rendered under the navigation — the price chip on the app shell. */
  footer?: React.ReactNode;
  onNavigate?: () => void;
  className?: string;
}

export function SidebarNav({
  groups = APP_NAV,
  isAdmin = false,
  onNavigate,
}: Pick<AppSidebarProps, "groups" | "isAdmin" | "onNavigate">) {
  const pathname = usePathname();

  return (
    <nav aria-label="Application" className="space-y-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {isAdmin && (
        <div className="border-t border-sidebar-border pt-4">
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            Admin console
          </Link>
        </div>
      )}
    </nav>
  );
}

/** Sticky desktop sidebar. Hidden below the `lg` breakpoint. */
export function AppSidebar({ isAdmin, groups, footer, className }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        className,
      )}
    >
      <div className="flex h-15 shrink-0 items-center gap-2 border-b border-sidebar-border px-5">
        <Logo />
        <DemoBadge className="ml-auto" label="Demo" />
      </div>

      <ScrollArea className="flex-1">
        <SidebarNav groups={groups} isAdmin={isAdmin} />
      </ScrollArea>

      {footer && <div className="shrink-0 border-t border-sidebar-border p-3">{footer}</div>}
    </aside>
  );
}
