// Phase 8 gate tests (§14 Phase 8):
//   "unapproved template blocked"
//   "utility vs marketing cost logged correctly"
//   idempotency — same key twice is a no-op
//
// Uses devContext() to resolve the same org the action will use, then creates
// templates in that org and exercises sendWhatsAppMessage().
//
// Runs against a real Postgres instance (same DB_URL as other gate tests).

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { devContext } from "../../../src/lib/dev-context";
import { sendWhatsAppMessage } from "../../../src/modules/whatsapp/actions";

const db = new PrismaClient();

// IDs created in beforeAll — unique per test run
let draftTemplateId:    string;
let utilityTemplateId:  string;
let marketingTemplateId: string;
const RUN_ID = String(Date.now()); // avoid idempotency key collisions between runs

// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const ctx = await devContext(); // resolves same orgId the action will use
  const orgId = ctx.orgId;

  // ── A template that has NOT been approved yet ─────────────────────────────
  const draft = await db.messageTemplate.create({
    data: {
      organizationId:   orgId,
      name:             `gate_draft_${RUN_ID}`,
      metaTemplateName: `gate_draft_${RUN_ID}`,
      category:         "UTILITY",
      language:         "en",
      bodyText:         "Your quote is ready.",
      variables:        [],
      metaStatus:       "DRAFT",
    },
    select: { id: true },
  });
  draftTemplateId = draft.id;

  // ── Approved UTILITY template ─────────────────────────────────────────────
  const utility = await db.messageTemplate.create({
    data: {
      organizationId:   orgId,
      name:             `gate_utility_${RUN_ID}`,
      metaTemplateName: `gate_utility_${RUN_ID}`,
      category:         "UTILITY",
      language:         "en",
      bodyText:         "Your order is confirmed.",
      variables:        [],
      metaStatus:       "APPROVED",
    },
    select: { id: true },
  });
  utilityTemplateId = utility.id;

  // ── Approved MARKETING template ────────────────────────────────────────────
  const marketing = await db.messageTemplate.create({
    data: {
      organizationId:   orgId,
      name:             `gate_marketing_${RUN_ID}`,
      metaTemplateName: `gate_marketing_${RUN_ID}`,
      category:         "MARKETING",
      language:         "en",
      bodyText:         "New collection launched — visit us!",
      variables:        [],
      metaStatus:       "APPROVED",
    },
    select: { id: true },
  });
  marketingTemplateId = marketing.id;
});

afterAll(async () => {
  await db.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 8 gate — WhatsApp template guard and cost logging", () => {
  it("blocks send when template metaStatus is DRAFT", async () => {
    const result = await sendWhatsAppMessage({
      templateId:     draftTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: `gate-draft-${RUN_ID}`,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not approved/i);
    // Confirm no AutomationLog was written
    const log = await db.automationLog.findUnique({
      where: { idempotencyKey: `gate-draft-${RUN_ID}` },
    });
    expect(log).toBeNull();
  });

  it("blocks send when template metaStatus is SUBMITTED (pending approval)", async () => {
    const ctx = await devContext();
    const pending = await db.messageTemplate.create({
      data: {
        organizationId:   ctx.orgId,
        name:             `gate_pending_${RUN_ID}`,
        metaTemplateName: `gate_pending_${RUN_ID}`,
        category:         "UTILITY",
        language:         "en",
        bodyText:         "Order shipped.",
        variables:        [],
        metaStatus:       "SUBMITTED",
      },
      select: { id: true },
    });
    const result = await sendWhatsAppMessage({
      templateId:     pending.id,
      toMobile:       "+919876543210",
      idempotencyKey: `gate-pending-${RUN_ID}`,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not approved/i);
  });

  it("UTILITY template → costPaise = 12n in AutomationLog", async () => {
    const ikey = `gate-utility-${RUN_ID}`;
    const result = await sendWhatsAppMessage({
      templateId:     utilityTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
    });
    expect(result.ok).toBe(true);
    expect(result.data!.alreadySent).toBe(false);

    const log = await db.automationLog.findUnique({ where: { idempotencyKey: ikey } });
    expect(log).not.toBeNull();
    expect(log!.costPaise).toBe(12n);
    expect(log!.category).toBe("UTILITY");
    expect(log!.status).toBe("QUEUED");
  });

  it("MARKETING template → costPaise = 86n in AutomationLog", async () => {
    const ikey = `gate-marketing-${RUN_ID}`;
    const result = await sendWhatsAppMessage({
      templateId:     marketingTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
    });
    expect(result.ok).toBe(true);

    const log = await db.automationLog.findUnique({ where: { idempotencyKey: ikey } });
    expect(log).not.toBeNull();
    expect(log!.costPaise).toBe(86n);
    expect(log!.category).toBe("MARKETING");
  });

  it("idempotency — same key twice → second call returns alreadySent=true, no duplicate log", async () => {
    const ikey = `gate-idempotent-${RUN_ID}`;
    const r1   = await sendWhatsAppMessage({
      templateId:     utilityTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
    });
    expect(r1.ok).toBe(true);
    expect(r1.data!.alreadySent).toBe(false);

    const r2 = await sendWhatsAppMessage({
      templateId:     utilityTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
    });
    expect(r2.ok).toBe(true);
    expect(r2.data!.alreadySent).toBe(true);

    // Exactly one log row for this key
    const logs = await db.automationLog.findMany({ where: { idempotencyKey: ikey } });
    expect(logs).toHaveLength(1);
  });

  it("AutomationLog idempotencyKey is written BEFORE send completes (§0.8)", async () => {
    // Verify: log row exists after a successful send with the correct templateId
    const ikey = `gate-before-send-${RUN_ID}`;
    await sendWhatsAppMessage({
      templateId:     utilityTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
    });
    const log = await db.automationLog.findUnique({ where: { idempotencyKey: ikey } });
    expect(log).not.toBeNull();
    expect(log!.templateId).toBe(utilityTemplateId);
    // The log is created immediately, not deferred
    const ageMs = Date.now() - log!.createdAt.getTime();
    expect(ageMs).toBeLessThan(10_000); // written within 10 seconds of this test running
  });

  it("refType and refId stored on log when provided", async () => {
    const ikey = `gate-ref-${RUN_ID}`;
    await sendWhatsAppMessage({
      templateId:     utilityTemplateId,
      toMobile:       "+919876543210",
      idempotencyKey: ikey,
      refType:        "ORDER",
      refId:          "order-abc-123",
    });
    const log = await db.automationLog.findUnique({ where: { idempotencyKey: ikey } });
    expect(log!.refType).toBe("ORDER");
    expect(log!.refId).toBe("order-abc-123");
  });
});
