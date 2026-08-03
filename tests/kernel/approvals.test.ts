import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { scoped } from "@/kernel/db/scoped";
import {
  ApprovalAlreadyDecidedError, ApprovalNotFoundError,
  decideApproval, requestApproval, WrongApproverError,
  type ApprovalRule,
} from "@/kernel/approvals/engine";
import { collectEvents } from "@/kernel/events/bus";
import { setupTwoTenants, type Tenant } from "./fixtures";

const db = new PrismaClient();
let A: Tenant;
let otherUserCtx: Tenant["ctx"];

interface Quote { total: bigint; discountPct: number }

const DISCOUNT_RULE: ApprovalRule<Quote> = {
  entityType: "Quotation",
  needsApproval: (q) => q.discountPct > 10
    ? { needed: true, reason: `discount ${q.discountPct} % exceeds 10 % floor` }
    : { needed: false },
  approverChain: (_q, ctx) => [ctx.userId],  // for the test, user approves themselves
};

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  otherUserCtx = { ...A.ctx, userId: "different-user-id" };
});

describe("requestApproval", () => {
  it("returns null when the rule says approval is not needed", async () => {
    const result = await requestApproval(scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 5 }, "q1", A.ctx);
    expect(result).toBeNull();
  });

  it("creates a PENDING Approval row when needed", async () => {
    const result = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q2", A.ctx,
    );
    expect(result).not.toBeNull();
    expect(result?.state).toBe("PENDING");
    expect(result?.entityType).toBe("Quotation");
    expect(result?.reason).toContain("15");
  });

  it("publishes an approval.requested event via the collector", async () => {
    const events = collectEvents();
    const row = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 20 }, "q3", A.ctx, events,
    );
    expect(row).not.toBeNull();
    const pending = events.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("approval.requested");
  });
});

describe("decideApproval", () => {
  it("approves and stores decidedAt", async () => {
    const created = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q-approve", A.ctx,
    );
    expect(created).not.toBeNull();
    const updated = await decideApproval(scoped(A.ctx), created!.id, "APPROVED", A.ctx);
    expect(updated.state).toBe("APPROVED");
    expect(updated.approverId).toBe(A.userId);
  });

  it("rejects with a note", async () => {
    const created = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q-reject", A.ctx,
    );
    const updated = await decideApproval(
      scoped(A.ctx), created!.id, "REJECTED", A.ctx, { note: "too aggressive" },
    );
    expect(updated.state).toBe("REJECTED");
  });

  it("reject without a note throws", async () => {
    const created = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q-reject-nn", A.ctx,
    );
    await expect(decideApproval(scoped(A.ctx), created!.id, "REJECTED", A.ctx))
      .rejects.toThrow(/note/);
  });

  it("cannot decide twice", async () => {
    const created = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q-twice", A.ctx,
    );
    await decideApproval(scoped(A.ctx), created!.id, "APPROVED", A.ctx);
    await expect(decideApproval(scoped(A.ctx), created!.id, "APPROVED", A.ctx))
      .rejects.toThrow(ApprovalAlreadyDecidedError);
  });

  it("wrong approver is rejected", async () => {
    const created = await requestApproval(
      scoped(A.ctx), DISCOUNT_RULE, { total: 100n, discountPct: 15 }, "q-wrong", A.ctx,
    );
    await expect(decideApproval(scoped(A.ctx), created!.id, "APPROVED", otherUserCtx))
      .rejects.toThrow(WrongApproverError);
  });

  it("unknown approval id throws", async () => {
    await expect(decideApproval(scoped(A.ctx), "nope", "APPROVED", A.ctx))
      .rejects.toThrow(ApprovalNotFoundError);
  });
});
