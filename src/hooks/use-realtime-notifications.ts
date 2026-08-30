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
  callbackRef.current = onNotification;

  React.useEffect(() => setUnread(initialUnread), [initialUnread]);

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
