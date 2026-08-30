"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/types/database";

/**
 * Keeps the notification bell in sync without polling.
 *
 * Subscribes to inserts on the caller's own notification rows only; RLS makes
 * the filter authoritative rather than advisory. The channel is torn down on
 * unmount so a navigation never leaves a socket behind.
 */
export function useRealtimeNotifications(
  userId: string,
  initialUnread: number,
  onNotification?: (notification: AppNotification) => void,
) {
  const [unread, setUnread] = React.useState(initialUnread);
  const callbackRef = React.useRef(onNotification);

  // Writing a ref during render is not safe under concurrent rendering; keep
  // the latest callback in sync from an effect instead.
  React.useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  // The server-rendered count is the source of truth: adopt it whenever the
  // page revalidates, keyed off the value itself rather than an effect body
  // that calls setState unconditionally.
  const [lastServerCount, setLastServerCount] = React.useState(initialUnread);
  if (lastServerCount !== initialUnread) {
    setLastServerCount(initialUnread);
    setUnread(initialUnread);
  }

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((count) => count + 1);
          callbackRef.current?.(payload.new as AppNotification);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unread, setUnread };
}
