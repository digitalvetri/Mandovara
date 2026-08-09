// Pure functions for PO / GRN business logic — no I/O, fully testable.

import { Decimal } from "@prisma/client/runtime/library";

export type POStatus = "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export interface POLineStatus {
  quantity: Decimal;
  receivedQty: Decimal;
}

/**
 * Recompute PO status from the current state of its lines.
 * allComplete  → RECEIVED
 * anyReceived  → PARTIAL
 * else         → currentStatus unchanged (DRAFT or SENT)
 */
export function computePOStatus(
  currentStatus: POStatus,
  lines: POLineStatus[],
): POStatus {
  if (lines.length === 0) return currentStatus;
  const allComplete = lines.every((l) => l.receivedQty.gte(l.quantity));
  if (allComplete) return "RECEIVED";
  const anyReceived = lines.some((l) => l.receivedQty.gt(new Decimal(0)));
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
