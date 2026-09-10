// "Bill after the money is in" — the one gate, shared by every door that
// raises an invoice for a project.
//
// The studio's sequence is quote → client agrees → collect → invoice. The
// tax invoice is the last document of a job, not the first. Raising one
// while the job is still being paid for splits the same debt across two
// places — the project's balance and the invoice's outstanding — and that
// split is precisely what made honest advances read "not matched to a bill"
// in Accounts → Received.
//
// It is a default, not a wall. A client who needs the tax invoice at supply
// — a company claiming input credit, most often — cannot be made to wait for
// someone else's internal sequence, so an owner can step over it. The
// balance then rides on the invoice as an ordinary outstanding amount, which
// is exactly what an invoice is for.

import type { scoped } from "@/kernel/db/scoped";
import { can } from "@/kernel/rbac/guard";
import { formatINR } from "@/kernel/money/format";
import { getProjectReceivable } from "@/modules/projects/receivable";
import type { RequestContext } from "@/kernel/auth/context";

export interface GateRefusal {
  ok: false;
  errorCode: "PROJECT_NOT_SETTLED";
  error: string;
  /** True when the caller could get through by re-submitting with billEarly. */
  canOverride: boolean;
  /** Still to collect, so the UI can say the number without asking again. */
  due: string;
}

/** Returns null when the invoice may be raised, or the refusal to return. */
export async function checkProjectSettledForInvoice(
  ctx:       RequestContext,
  db:        ReturnType<typeof scoped>,
  projectId: string,
  billEarly: boolean,
): Promise<GateRefusal | null> {
  const receivable = await getProjectReceivable(db, projectId);
  if (!receivable || receivable.due <= 0n) return null;

  // Enforced here, server-side, and not only by hiding a button
  // (CLAUDE.md #11).
  const canOverride = can(ctx, "quotation.approve");

  if (billEarly && canOverride) return null;

  return {
    ok: false,
    errorCode: "PROJECT_NOT_SETTLED",
    canOverride,
    due: receivable.due.toString(),
    error: billEarly && !canOverride
      ? "Only the studio owner can raise an invoice before the payment is in."
      : `${formatINR(receivable.due)} is still to be collected on this job. ` +
        "The bill is raised once the payment is in." +
        (canOverride ? " Choose “Bill anyway” if this client needs it now." : ""),
  };
}
