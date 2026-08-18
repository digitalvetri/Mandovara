"use server";

// GRN receipt action — separated from actions.ts to keep both files under 300 lines.
// Posts a Goods Receipt Note against a PO:
//   • Validates dye lot is present for mandatory families
//   • Matches GRN lines to POLines by colourwayId (FIFO by POLine.id)
//   • Guards against over-receive per line
//   • Increments POLine.receivedQty in the same transaction
//   • Recomputes PO status (PARTIAL or RECEIVED)


export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}
