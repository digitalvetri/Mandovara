// Pure functions for PO / GRN business logic — no I/O, fully testable.

import { Decimal } from "@prisma/client/runtime/library";

export type POStatus = "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export interface POLineStatus {
  quantity: Decimal;
  receivedQty: Decimal;
  /**
   * True for a line that names a typed item rather than a catalogued
   * colourway. Goods receipt posts stock against a colourway, so such a
   * line has nothing to receive into and never accumulates receivedQty.
   */
  isFreeText?: boolean;
}

/**
 * Recompute PO status from the current state of its lines.
 * allComplete  → RECEIVED
 * anyReceived  → PARTIAL
 * else         → currentStatus unchanged (DRAFT or SENT)
 *
 * Typed lines are excluded from the completeness test. They cannot be
 * received, so counting them would strand every PO carrying one in PARTIAL
 * for good — and the expense that follows a RECEIVED PO would never be
 * raised. A PO of nothing but typed lines keeps its current status.
 */
export function computePOStatus(
  currentStatus: POStatus,
  lines: POLineStatus[],
): POStatus {
  if (lines.length === 0) return currentStatus;
  const receivable = lines.filter((l) => !l.isFreeText);
  if (receivable.length === 0) return currentStatus;
  const allComplete = receivable.every((l) => l.receivedQty.gte(l.quantity));
  if (allComplete) return "RECEIVED";
  const anyReceived = receivable.some((l) => l.receivedQty.gt(new Decimal(0)));
  if (anyReceived) return "PARTIAL";
  return currentStatus;
}

/**
 * Compute pending quantity per line (quantity − receivedQty).
 * Returns a Decimal for each line in the same order.
 */
export function computePendingQty(lines: POLineStatus[]): Decimal[] {
  return lines.map((l) => l.quantity.minus(l.receivedQty));
}

/** Families that require a dye lot on every GRN receipt. */
export const MANDATORY_DYE_LOT_FAMILIES = new Set([
  "WALLPAPER",
  "CURTAIN_FABRIC",
  "SHEER",
  "UPHOLSTERY_FABRIC",
  "CARPET_ROLL",
]);
