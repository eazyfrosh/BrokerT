"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

const TONE: Record<string, string> = {
  order_filled: "bg-success",
  order_update: "bg-primary",
  investment_update: "bg-chart-3",
  portfolio_alert: "bg-chart-5",
  security_alert: "bg-destructive",
  new_investment: "bg-chart-6",
  car_order_update: "bg-chart-2",
  system: "bg-muted-foreground",
};

export function NotificationBell({
  userId,
  initialUnread,
  initialItems,
}: {
  userId: string;
  initialUnread: number;
  initialItems: AppNotification[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [pending, startTransition] = React.useTransition();

  const { unread, setUnread } = useRealtimeNotifications(userId, initialUnread, (notification) => {
    setItems((current) => [notification, ...current].slice(0, 12));
    toast(notification.title, { description: notification.message });
  });

  // Adopt a newer server snapshot when the page revalidates. Comparing the
  // incoming prop against the last one we accepted avoids re-setting state on
  // every render, which an effect would do.
  const [lastServerItems, setLastServerItems] = React.useState(initialItems);
  if (lastServerItems !== initialItems) {
    setLastServerItems(initialItems);
    setItems(initialItems);
  }

  function markOne(notification: AppNotification) {
    if (notification.read_at) return;
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
    setUnread((count) => Math.max(count - 1, 0));
    startTransition(async () => {
      await markNotificationReadAction(notification.id);
      router.refresh();
    });
  }

  function markAll() {
    setItems((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() })),
    );
    setUnread(0);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold leading-4 text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} disabled={pending} className="h-7 text-xs">
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <Separator />

        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Order fills, allocation updates and security alerts will appear here."
            compact
            className="m-3 border-0"
          />
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const body = (
                  <div className="flex gap-2.5">
                    <span
                      className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE[item.type] ?? "bg-muted-foreground")}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", !item.read_at && "font-semibold")}>{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[0.6875rem] text-muted-foreground/80">
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id} className={cn(!item.read_at && "bg-primary/4")}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => markOne(item)}
                        className="block px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markOne(item)}
                        className="block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <Separator />
        <div className="p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
