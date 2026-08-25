// Shared advance-gate helper. When cumulative money received on a
// project (Advance rows + Receipt rows) meets the order's required
// advance, auto-advance the project stage ORDERED → PROCUREMENT so the
// customer-facing "Advance Awaited" phase flips to "Installation".
//
// Called from both createAdvance (legacy advance table path) and
// createReceipt (owner's canonical flow: invoice → receipt → install).
// Best-effort — a failure never blocks the write that triggered it.

import type { scoped } from "@/kernel/db/scoped";
import type { TxClient } from "@/kernel/db/transaction";

// Accepts either the org-scoped app client (from `scoped(ctx)`) or a
// transaction client. Both expose the model methods the gate needs.
type Db = ReturnType<typeof scoped> | TxClient;

const ADVANCE_ELIGIBLE_STAGES = new Set(["QUOTATION", "MEASUREMENT", "ORDERED"]);

/** Run the gate for every project touched by a receipt — a receipt row
 *  usually has no projectId, but its allocated invoices do. Returns the
 *  set of project IDs it evaluated so the caller can revalidate paths. */
export async function checkGateForReceipt(
  db:                Db,
  opts: { receiptProjectId: string | null; invoiceIds: string[] },
): Promise<string[]> {
  const projectIds = new Set<string>();
  if (opts.receiptProjectId) projectIds.add(opts.receiptProjectId);
  if (opts.invoiceIds.length > 0) {
    const invs = await db.invoice.findMany({
      where:  { id: { in: opts.invoiceIds } },
      select: { projectId: true },
    });
    for (const inv of invs) if (inv.projectId) projectIds.add(inv.projectId);
  }
  for (const pid of projectIds) await checkAndAdvanceStage(db, pid);
  return [...projectIds];
}

export async function checkAndAdvanceStage(
  db:        Db,
  projectId: string,
): Promise<{ advanced: boolean; totalReceived: bigint; required: bigint }> {
  try {
    const [advAgg, receiptAgg, requiredAgg, project] = await Promise.all([
      db.advance.aggregate({
        where: { projectId },
        _sum:  { amount: true },
      }),
      db.receipt.aggregate({
        where: { projectId },
        _sum:  { amount: true },
      }),
      db.order.aggregate({
        where: { projectId, status: { not: "CANCELLED" } },
        _sum:  { advanceRequired: true },
      }),
      db.project.findUnique({
        where:  { id: projectId },
        select: { stage: true },
      }),
    ]);

    const advTotal      = advAgg._sum.amount            ?? 0n;
    const receiptTotal  = receiptAgg._sum.amount        ?? 0n;
    const totalReceived = advTotal + receiptTotal;
    const required      = requiredAgg._sum.advanceRequired ?? 0n;

    const gateOpen = required > 0n
      ? totalReceived >= required
      : totalReceived > 0n;

    const stageOk = project ? ADVANCE_ELIGIBLE_STAGES.has(project.stage) : false;

    if (gateOpen && stageOk) {
      await db.project.update({
        where: { id: projectId },
        data:  { stage: "PROCUREMENT" },  // → Installation phase (customer-facing)
      });
      return { advanced: true, totalReceived, required };
    }
    return { advanced: false, totalReceived, required };
  } catch (err) {
    console.warn("advance-gate check failed (best-effort):", err);
    return { advanced: false, totalReceived: 0n, required: 0n };
  }
}
