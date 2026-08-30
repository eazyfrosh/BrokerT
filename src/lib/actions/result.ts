import type { ZodError } from "zod";

export interface ActionSuccess<T = undefined> {
  ok: true;
  data: T;
  message?: string;
}

export interface ActionFailure {
  ok: false;
  /** Message safe to render to the user — never a raw backend error. */
  error: string;
  fieldErrors?: Record<string, string>;
}

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function ok<T = undefined>(data: T = undefined as T, message?: string): ActionSuccess<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionFailure {
  return { ok: false, error, fieldErrors };
}

/** Flattens a Zod error into one message per field. */
export function fromZodError(error: ZodError, message = "Please correct the highlighted fields."): ActionFailure {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail(message, fieldErrors);
}

/**
 * Maps the error codes raised by the database functions onto messages a user
 * can act on. Anything unrecognised falls back to a generic message so
 * internal details never leak.
 */
const DB_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  PROFILE_MISSING: "Your profile could not be found. Please sign in again.",
  ACCOUNT_NOT_ACTIVE: "Your account is not active. Contact support for help.",
  INVALID_QUANTITY: "Enter a quantity greater than zero.",
  INVALID_AMOUNT: "Enter an amount greater than zero.",
  INVALID_TOTAL: "That configuration total is not valid.",
  INVALID_TYPE: "That operation is not supported.",
  ASSET_NOT_FOUND: "That instrument is not available.",
  ASSET_NOT_TRADABLE: "That instrument is not currently tradable.",
  QUOTE_UNAVAILABLE: "No price is available for that instrument right now.",
  LIMIT_PRICE_REQUIRED: "Enter a limit price for this order type.",
  STOP_PRICE_REQUIRED: "Enter a stop price for this order type.",
  INSUFFICIENT_FUNDS: "You do not have enough available cash for this.",
  INSUFFICIENT_POSITION: "You do not hold enough of this asset to sell.",
  WALLET_MISSING: "Your cash account could not be found. Contact support.",
  ORDER_NOT_FOUND: "That order could not be found.",
  ORDER_NOT_CANCELLABLE: "That order can no longer be cancelled.",
  INVESTMENT_NOT_FOUND: "That strategy could not be found.",
  INVESTMENT_NOT_OPEN: "That strategy is not open for new allocations.",
  BELOW_MINIMUM: "That amount is below the strategy's minimum.",
  ABOVE_MAXIMUM: "That amount is above the strategy's maximum.",
  CAPACITY_EXCEEDED: "That strategy does not have enough remaining capacity.",
  VEHICLE_NOT_FOUND: "That vehicle could not be found.",
  VEHICLE_UNAVAILABLE: "That vehicle is not currently available to configure.",
  DEMO_MODE_DISABLED: "Simulated cash movements are disabled. Connect a payment provider to fund accounts.",
  AMOUNT_TOO_LARGE: "That amount exceeds the demo limit.",
  USER_NOT_FOUND: "That user could not be found.",
  CANNOT_MODIFY_SELF: "You cannot apply this change to your own account.",
  CAR_ORDER_NOT_FOUND: "That vehicle order could not be found.",
  ROLE_CHANGE_FORBIDDEN: "You cannot change your own role.",
  STATUS_CHANGE_FORBIDDEN: "You cannot change your own account status.",
  KYC_CHANGE_FORBIDDEN: "Verification status is managed by our team.",
  FIELD_UPDATE_FORBIDDEN: "Some of those fields cannot be changed.",
  AUDIT_LOG_IMMUTABLE: "Audit records cannot be modified.",
};

export function fromDatabaseError(error: { message?: string } | null, fallback: string): ActionFailure {
  const raw = error?.message ?? "";
  for (const [code, message] of Object.entries(DB_ERROR_MESSAGES)) {
    if (raw.includes(code)) return fail(message);
  }
  return fail(fallback);
}
