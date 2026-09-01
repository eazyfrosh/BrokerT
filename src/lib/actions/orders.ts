"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { placeOrderSchema, cancelOrderSchema } from "@/lib/validation/schemas";
import { getRequestOrigin } from "@/lib/request-origin";
import { sendEmail, orderConfirmationEmail } from "@/lib/email";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";
import type { Order } from "@/types/database";

export interface PlacedOrder {
  id: string;
  reference: string;
  status: Order["status"];
  side: Order["side"];
  quantity: number;
  filledQuantity: number;
  averageFillPrice: number | null;
  estimatedPrice: number | null;
  fees: number;
  symbol: string;
}

/**
 * Submits an order.
 *
 * All validation that matters happens inside `public.place_order()`: the fill
 * price comes from the server-held quote, buying power and position are checked
 * under a row lock, and the order, fill, holding, wallet, ledger and
 * notification writes all land in one transaction. The Zod pass here only
 * rejects obviously malformed input before the round trip.
 */
export async function placeOrderAction(input: unknown): Promise<ActionResult<PlacedOrder>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to place an order.");
  if (session.profile.account_status !== "active") {
    return fail("Your account is not active, so orders cannot be placed.");
  }

  const { assetId, side, orderType, quantity, limitPrice, stopPrice, timeInForce } = parsed.data;

  const { data, error } = await session.supabase.rpc("place_order", {
    p_asset_id: assetId,
    p_side: side,
    p_order_type: orderType,
    p_quantity: quantity,
    p_limit_price: orderType === "limit" || orderType === "stop_limit" ? limitPrice : null,
    p_stop_price: orderType === "stop" || orderType === "stop_limit" ? stopPrice : null,
    p_time_in_force: timeInForce,
  });

  if (error) return fromDatabaseError(error, "We could not place that order. Please try again.");

  const order = data as unknown as Order | null;
  if (!order) return fail("We could not place that order. Please try again.");

  const { data: asset } = await session.supabase
    .from("assets")
    .select("symbol")
    .eq("id", assetId)
    .maybeSingle<{ symbol: string }>();

  const symbol = asset?.symbol ?? "";

  if (order.status === "filled" && order.average_fill_price) {
    // Email delivery must never fail the order that has already committed.
    await sendEmail(
      orderConfirmationEmail(
        session.profile.email,
        {
          reference: order.reference,
          side: side === "buy" ? "Buy" : "Sell",
          quantity: formatQuantity(order.quantity),
          symbol,
          price: formatCurrency(order.average_fill_price),
          total: formatCurrency(order.quantity * order.average_fill_price),
        },
        await getRequestOrigin(),
      ),
    ).catch(() => undefined);
  }

  for (const path of ["/dashboard", "/portfolio", "/orders", "/trade", "/transactions", "/wallet"]) {
    revalidatePath(path);
  }

  return ok<PlacedOrder>({
    id: order.id,
    reference: order.reference,
    status: order.status,
    side: order.side,
    quantity: Number(order.quantity),
    filledQuantity: Number(order.filled_quantity),
    averageFillPrice: order.average_fill_price === null ? null : Number(order.average_fill_price),
    estimatedPrice: order.estimated_price === null ? null : Number(order.estimated_price),
    fees: Number(order.fees),
    symbol,
  });
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const parsed = cancelOrderSchema.safeParse({ orderId });
  if (!parsed.success) return fail("That order could not be found.");

  const session = await getSessionContext();
  if (!session?.profile) return fail("Please sign in to continue.");

  const { error } = await session.supabase.rpc("cancel_order", { p_order_id: parsed.data.orderId });
  if (error) return fromDatabaseError(error, "We could not cancel that order.");

  for (const path of ["/dashboard", "/orders", "/portfolio", "/wallet"]) {
    revalidatePath(path);
  }
  revalidatePath(`/orders/${parsed.data.orderId}`);

  return ok(undefined, "Order cancelled.");
}
