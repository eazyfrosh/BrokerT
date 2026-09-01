"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { allocateInvestmentSchema } from "@/lib/validation/schemas";
import { getRequestOrigin } from "@/lib/request-origin";
import { sendEmail, investmentUpdateEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/format";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";
import type { InvestmentPosition } from "@/types/database";

export interface AllocationReceipt {
  id: string;
  reference: string;
  principal: number;
  targetDate: string;
  investmentName: string;
}

/**
 * Allocates cash to an investment strategy.
 *
 * `create_investment_position()` performs the whole movement in one
 * transaction: it locks the wallet, re-checks the minimum, maximum and
 * remaining capacity against the stored product, debits cash, opens the
 * position and writes the ledger entry. None of those limits are trusted from
 * the browser.
 */
export async function allocateInvestmentAction(input: unknown): Promise<ActionResult<AllocationReceipt>> {
  const parsed = allocateInvestmentSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to allocate to a strategy.");
  if (session.profile.account_status !== "active") {
    return fail("Your account is not active, so allocations cannot be made.");
  }

  const { data, error } = await session.supabase.rpc("create_investment_position", {
    p_investment_id: parsed.data.investmentId,
    p_amount: parsed.data.amount,
  });

  if (error) return fromDatabaseError(error, "We could not complete that allocation.");

  const position = data as unknown as InvestmentPosition | null;
  if (!position) return fail("We could not complete that allocation.");

  const { data: investment } = await session.supabase
    .from("investments")
    .select("name")
    .eq("id", parsed.data.investmentId)
    .maybeSingle<{ name: string }>();

  const investmentName = investment?.name ?? "Strategy";

  await sendEmail(
    investmentUpdateEmail(
      session.profile.email,
      {
        name: investmentName,
        reference: position.reference,
        amount: formatCurrency(parsed.data.amount),
      },
      await getRequestOrigin(),
    ),
  ).catch(() => undefined);

  for (const path of ["/dashboard", "/portfolio", "/investments", "/investments/active", "/transactions", "/wallet"]) {
    revalidatePath(path);
  }

  return ok<AllocationReceipt>({
    id: position.id,
    reference: position.reference,
    principal: Number(position.principal),
    targetDate: position.target_date,
    investmentName,
  });
}
