import type { OrderStatus } from "@/types/database";

/**
 * Statuses a customer may cancel from. Shared by the server service and the
 * client table so both agree on when the button appears.
 */
export function isCancellable(status: OrderStatus): boolean {
  return status === "pending" || status === "submitted" || status === "partially_filled";
}
