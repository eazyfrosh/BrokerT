"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "./result";

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("That notification could not be found.");

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  // RLS restricts this to the caller's own rows, and a trigger blocks any
  // change other than read_at.
  const { error } = await session.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("read_at", null);

  if (error) return fail("We could not update that notification.");

  revalidatePath("/notifications");
  return ok();
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  const { data, error } = await session.supabase.rpc("mark_all_notifications_read");
  if (error) return fail("We could not update your notifications.");

  revalidatePath("/notifications");
  return ok((data as number) ?? 0, "All notifications marked as read.");
}

export async function deleteNotificationAction(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("That notification could not be found.");

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  const { error } = await session.supabase.from("notifications").delete().eq("id", parsed.data);
  if (error) return fail("We could not remove that notification.");

  revalidatePath("/notifications");
  return ok();
}
