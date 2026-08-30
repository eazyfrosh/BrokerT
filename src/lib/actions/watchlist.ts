"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { watchlistItemSchema, uuidSchema } from "@/lib/validation/schemas";
import { ok, fail, fromZodError, type ActionResult } from "./result";

export async function addToWatchlistAction(input: unknown): Promise<ActionResult> {
  const parsed = watchlistItemSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to continue.");

  // Provisioned by handle_new_user(), but an account created before that
  // trigger existed may not have one.
  const { data: watchlist } = await session.supabase
    .from("watchlists")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  let watchlistId = watchlist?.id;
  if (!watchlistId) {
    const { data: created, error } = await session.supabase
      .from("watchlists")
      .insert({ user_id: session.user.id, name: "My watchlist", is_default: true })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return fail("We could not create your watchlist.");
    watchlistId = created.id;
  }

  const { error } = await session.supabase.from("watchlist_items").insert({
    watchlist_id: watchlistId,
    user_id: session.user.id,
    asset_id: parsed.data.assetId,
    note: parsed.data.note || null,
  });

  if (error) {
    if (error.code === "23505") return fail("That instrument is already on your watchlist.");
    return fail("We could not add that instrument.");
  }

  revalidatePath("/watchlist");
  return ok(undefined, "Added to your watchlist.");
}

export async function removeFromWatchlistAction(itemId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(itemId);
  if (!parsed.success) return fail("That item could not be found.");

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to continue.");

  const { error } = await session.supabase.from("watchlist_items").delete().eq("id", parsed.data);
  if (error) return fail("We could not remove that instrument.");

  revalidatePath("/watchlist");
  return ok(undefined, "Removed from your watchlist.");
}
