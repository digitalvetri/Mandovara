// Approval engine — generic entity + threshold + approver-chain + state.
//
// No generic Approval DB model exists in CLAUDE.md §5 — approval states are
// embedded on domain models (ProjectExpense.approvalState, Leave.state, etc.).
// This engine keeps approval rows in a module-level Map; it survives the
// test process lifetime and resets on restart. Fine for Phase 2-4 tests.
// Phase 5/6 can replace the Map with a DB table if needed.

import type { RequestContext } from "@/kernel/auth/context";
import type { ScopedClient } from "@/kernel/db/scoped";
import type { EventCollector } from "@/kernel/events/bus";

export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface ApprovalRule<T> {
  readonly entityType: string;
  readonly needsApproval: (entity: T, ctx: RequestContext) => { needed: boolean; reason?: string };
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

const _store = new Map<string, ApprovalRow>();
const _approvers = new Map<string, readonly string[]>();
let _seq = 0;

export async function requestApproval<T>(
  _db: ScopedClient,
  rule: ApprovalRule<T>,
  entity: T,
  entityId: string,
  ctx: RequestContext,
  events?: EventCollector,
): Promise<ApprovalRow | null> {
  const need = rule.needsApproval(entity, ctx);
  if (!need.needed) return null;

  const chain = rule.approverChain(entity, ctx);
  const id = `apr_${(++_seq).toString().padStart(6, "0")}_${entityId}`;
  const row: ApprovalRow = {
    id,
    entityType: rule.entityType,
    entityId,
    reason: need.reason ?? "Approval required",
    state: "PENDING",
    approverId: null,
  };
  _store.set(id, row);
  _approvers.set(id, chain);

  events?.publish({
    type: "approval.requested",
    orgId: ctx.orgId,
    actorId: ctx.userId,
    occurredAt: new Date(),
    approvalId: id,
    entityType: rule.entityType,
    entityId,
    approverId: chain[0] ?? null,
  });

  return { ...row };
}

export async function decideApproval(
  _db: ScopedClient,
  approvalId: string,
  decision: ApprovalDecision,
  ctx: RequestContext,
  options?: { note?: string; events?: EventCollector },
): Promise<ApprovalRow> {
  const row = _store.get(approvalId);
  if (!row) throw new ApprovalNotFoundError(approvalId);
  if (row.state !== "PENDING") throw new ApprovalAlreadyDecidedError(approvalId, row.state);

  const allowed = _approvers.get(approvalId) ?? [];
  if (!allowed.includes(ctx.userId)) throw new WrongApproverError(approvalId);

  if (decision === "REJECTED" && !options?.note) {
    throw new Error("A note is required when rejecting an approval");
  }

  const updated: ApprovalRow = { ...row, state: decision, approverId: ctx.userId };
  _store.set(approvalId, updated);
  return { ...updated };
}
