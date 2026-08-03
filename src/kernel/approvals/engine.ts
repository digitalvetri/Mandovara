// Approval engine — generic entity + threshold + approver-chain + state.
// Twelve Rules #10: this file is human-reviewed.
//
// docs/BUILD-SPEC.md §8.2 item 6:
//   "Generic: entity + threshold + approverChain + state. Discount approval,
//    PO approval, expense approval and credit-limit override are the same
//    mechanism with different configuration. Building four separate ones
//    is four times the bugs."
//
// The engine writes to the existing `Approval` model (schema.prisma). Each
// module (Session 13 discount, Session 15 PO, Session 17 expense, Session 12
// credit limit) registers an ApprovalRule describing:
//
//   - what triggers it (needsApproval)
//   - who approves and in what order (approverChain — sequential today,
//     parallel-quorum in a later iteration)
//   - what happens on decide (onApproved / onRejected side effects, invoked
//     via the event bus not directly here — this file stays pure)
//
// This session lands the engine + tests. Real ApprovalRule registrations
// live in module code from Session 12 onwards.

import type { RequestContext } from "@/kernel/auth/context";
import type { ScopedClient } from "@/kernel/db/scoped";
import type { EventCollector } from "@/kernel/events/bus";

export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface ApprovalRule<T> {
  /** Matches the `entityType` column on the Approval row. */
  readonly entityType: string;
  /**
   * Returns whether this entity needs approval RIGHT NOW.
   * `reason` is a short human-readable string stored on the Approval row
   * (e.g. "discount 18 % exceeds 12 % floor").
   */
  readonly needsApproval: (entity: T, ctx: RequestContext) => { needed: boolean; reason?: string };
  /**
   * Ordered list of user IDs who may approve. Session 6 supports the
   * first-approver-wins model; sequential multi-level lands with Session 13.
   */
  readonly approverChain: (entity: T, ctx: RequestContext) => readonly string[];
}

export interface ApprovalRow {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  state: ApprovalDecision | "PENDING";
  approverId: string | null;
}

/**
 * Request approval for an entity. If the rule says no approval is needed,
 * returns null. Otherwise creates an Approval row (state=PENDING) and
 * publishes an `approval.requested` event.
 */
export async function requestApproval<T>(
  db: ScopedClient,
  rule: ApprovalRule<T>,
  entity: T,
  entityId: string,
  ctx: RequestContext,
  events?: EventCollector,
): Promise<ApprovalRow | null> {
  const need = rule.needsApproval(entity, ctx);
  if (!need.needed) return null;
  const chain = rule.approverChain(entity, ctx);
  const firstApprover = chain[0] ?? null;

  const row = await db.approval.create({
    data: {
      orgId: ctx.orgId,   // overwritten by scoped(); kept to satisfy the type
      entityType: rule.entityType,
      entityId,
      reason: need.reason ?? "Requires approval",
      state: "PENDING",
      approverId: firstApprover,
    },
    select: { id: true, entityType: true, entityId: true, reason: true, state: true, approverId: true },
  });

  events?.publish({
    type: "approval.requested",
    orgId: ctx.orgId, actorId: ctx.userId, occurredAt: new Date(),
    approvalId: row.id, entityType: row.entityType, entityId: row.entityId,
    approverId: row.approverId,
  });

  return row;
}

export class ApprovalNotFoundError extends Error {
  constructor(id: string) { super(`Approval ${id} not found`); this.name = "ApprovalNotFoundError"; }
}
export class ApprovalAlreadyDecidedError extends Error {
  constructor(id: string, state: string) {
    super(`Approval ${id} already ${state}`);
    this.name = "ApprovalAlreadyDecidedError";
  }
}
export class WrongApproverError extends Error {
  constructor(id: string) { super(`You are not the assigned approver for ${id}`); this.name = "WrongApproverError"; }
}

/**
 * Record a decision on an approval. Idempotent: re-deciding a decided
 * approval throws. Only the assigned approver (or any user if approverId
 * was null) may decide.
 */
export async function decideApproval(
  db: ScopedClient,
  approvalId: string,
  decision: ApprovalDecision,
  ctx: RequestContext,
  options: { note?: string; events?: EventCollector } = {},
): Promise<ApprovalRow> {
  const existing = await db.approval.findUnique({
    where: { id: approvalId },
    select: { id: true, entityType: true, entityId: true, reason: true, state: true, approverId: true },
  });
  if (!existing) throw new ApprovalNotFoundError(approvalId);
  if (existing.state !== "PENDING") {
    throw new ApprovalAlreadyDecidedError(approvalId, existing.state);
  }
  if (existing.approverId != null && existing.approverId !== ctx.userId) {
    throw new WrongApproverError(approvalId);
  }
  if (decision === "REJECTED" && !options.note?.trim()) {
    throw new Error("Reject requires a note");
  }

  const updated = await db.approval.update({
    where: { id: approvalId },
    data: {
      state: decision,
      approverId: ctx.userId,
      decidedAt: new Date(),
      note: options.note ?? null,
    },
    select: { id: true, entityType: true, entityId: true, reason: true, state: true, approverId: true },
  });

  options.events?.publish({
    type: "approval.decided",
    orgId: ctx.orgId, actorId: ctx.userId, occurredAt: new Date(),
    approvalId: updated.id, entityType: updated.entityType, entityId: updated.entityId,
    decision, approverId: ctx.userId,
  });

  return updated;
}
