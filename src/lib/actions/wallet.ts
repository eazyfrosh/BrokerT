"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { cashMovementSchema } from "@/lib/validation/schemas";
import { DEMO_MODE } from "@/lib/config";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";
import type { Transaction } from "@/types/database";

export interface CashMovementReceipt {
  id: string;
  reference: string;
  type: "deposit" | "withdrawal";
  amount: number;
  balanceAfter: number | null;
}

/**
 * Simulated cash movement.
 *
 * This is the one place the platform changes a balance without a trade, and it
 * is deliberately fenced: `demo_cash_movement()` reads the `demo_mode` system
 * setting and refuses to run when it is off, so a production deployment must
 * connect a real payment provider rather than quietly reusing this path.
 * Nothing here touches a payment rail, and every record it writes is marked
 * simulated.
 */
export async function demoCashMovementAction(input: unknown): Promise<ActionResult<CashMovementReceipt>> {
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  if (!DEMO_MODE) {
    return fail(
      "Demo funding is disabled. Connect a regulated payment provider to fund accounts.",
    );
  }

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to continue.");
  if (session.profile.account_status !== "active") {
    return fail("Your account is not active, so balances cannot be changed.");
  }

  const { data, error } = await session.supabase.rpc("demo_cash_movement", {
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
  });

  if (error) return fromDatabaseError(error, "We could not complete that simulated movement.");

  const transaction = data as unknown as Transaction | null;
  if (!transaction) return fail("We could not complete that simulated movement.");

  for (const path of ["/wallet", "/deposits", "/withdrawals", "/transactions", "/dashboard", "/portfolio"]) {
    revalidatePath(path);
  }

  return ok<CashMovementReceipt>({
    id: transaction.id,
    reference: transaction.reference,
    type: parsed.data.type,
    amount: parsed.data.amount,
    balanceAfter: transaction.balance_after === null ? null : Number(transaction.balance_after),
  });
}
