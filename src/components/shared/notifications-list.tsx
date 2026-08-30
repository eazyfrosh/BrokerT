"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  deleteNotificationAction,
} from "@/lib/actions/notifications";
import { formatRelativeTime, formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "orders", label: "Orders" },
  { value: "investments", label: "Investments" },
  { value: "security", label: "Security" },
];

function matches(notification: AppNotification, filter: string): boolean {
  switch (filter) {
    case "unread":
      return notification.read_at === null;
    case "orders":
      return notification.type === "order_filled" || notification.type === "order_update";
    case "investments":
      return notification.type === "investment_update" || notification.type === "new_investment";
    case "security":
      return notification.type === "security_alert";
    default:
      return true;
  }
}

const TONE: Record<string, string> = {
  order_filled: "bg-success",
  order_update: "bg-primary",
  investment_update: "bg-chart-2",
  portfolio_alert: "bg-chart-4",
  security_alert: "bg-destructive",
  new_investment: "bg-chart-5",
  car_order_update: "bg-chart-6",
  system: "bg-muted-foreground",
};

export function NotificationsList({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("all");
  const [items, setItems] = React.useState(notifications);
  const [pending, startTransition] = React.useTransition();

  // Adopt a newer server snapshot when the page revalidates, without an effect
  // that calls setState on every render.
  const [lastServerItems, setLastServerItems] = React.useState(notifications);
  if (lastServerItems !== notifications) {
    setLastServerItems(notifications);
    setItems(notifications);
  }

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [option.value, items.filter((item) => matches(item, option.value)).length]),
      ),
    [items],
  );

  const rows = items.filter((item) => matches(item, filter));
  const unread = items.filter((item) => item.read_at === null).length;

  function markOne(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function markAll() {
    setItems((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() })),
    );
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    startTransition(async () => {
      const result = await deleteNotificationAction(id);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          options={FILTERS.map((option) => ({ ...option, count: counts[option.value] }))}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter notifications"
        />
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} disabled={pending}>
            <CheckCheck /> Mark all read
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "Nothing unread" : "No notifications"}
          description="Order fills, allocation updates, vehicle order stages and security alerts appear here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((item) => (
            <li
              key={item.id}
              className={cn("flex gap-3 p-4 transition-colors", !item.read_at && "bg-primary/4")}
            >
              <span
                className={cn("mt-2 size-2 shrink-0 rounded-full", TONE[item.type] ?? "bg-muted-foreground")}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("text-sm", !item.read_at && "font-semibold")}>{item.title}</p>
                  <Badge variant="secondary" className="text-[0.625rem]">
                    {titleCase(item.type)}
                  </Badge>
                  {!item.read_at && (
                    <Badge variant="default" className="text-[0.625rem]">
                      New
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.message}</p>
                <p className="mt-1.5 text-xs text-muted-foreground/80">
                  <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                    {formatRelativeTime(item.created_at)}
                  </time>
                </p>

                {item.link && (
                  <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
                    <Link href={item.link} onClick={() => !item.read_at && markOne(item.id)}>
                      Open
                    </Link>
                  </Button>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                {!item.read_at && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Mark as read"
                    disabled={pending}
                    onClick={() => markOne(item.id)}
                  >
                    <CheckCheck />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove notification"
                  disabled={pending}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
