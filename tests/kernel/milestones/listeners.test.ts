// @ts-nocheck
// DB-backed integration tests for milestone event listeners.
// Uses the real Postgres — covers the spec's tests #3 and #4:
//   - measurement.approved auto-completes MEASUREMENT milestone AND
//     advances project.stage → QUOTATION (but never regresses).
//   - advance.received with total < required does NOT complete ADVANCE.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { bus } from "@/kernel/events/bus";
import { registerMilestoneListeners } from "@/kernel/milestones/listeners";
import { setupTwoTenants, type Tenant } from "../fixtures";

let A: Tenant;

async function makeProject(t: Tenant, stage: "MEASUREMENT" | "QUOTATION" | "ORDERED"): Promise<string> {
  const p = await db.project.create({
    data: {
      organizationId: t.orgId,
      branchId:       t.branchId,
      number:         `MDV/PRJ-2608-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
      name:           `Test project ${stage}`,
      clientId:       await ensureClient(t),
      ownerId:        t.userId,
      stage,
      siteAddress:    {},
    },
    select: { id: true },
  });
  return p.id;
}

async function ensureClient(t: Tenant): Promise<string> {
  const c = await db.client.findFirst({ where: { organizationId: t.orgId } });
  if (c) return c.id;
  return (await db.client.create({
    data: {
      organizationId: t.orgId,
      code:           `MDV/CLI-2608-${Math.random().toString(36).slice(2, 6)}`,
      name:           "Test Client",
      mobile:         "+919000090000",
      billingAddress: {},
    },
    select: { id: true },
  })).id;
}

async function insertMilestone(orgId: string, projectId: string, opts: {
  code: string; name: string; family?: string | null;
  sourceEvent?: string | null; weight?: number; status?: string;
}): Promise<string> {
  const m = await db.milestone.create({
    data: {
      organizationId:   orgId,
      projectId,
      name:             opts.name,
      plannedDate:      new Date(),
      billingPct:       opts.weight ?? 0,
      billingWeightPct: opts.weight ?? 0,
      order:            10,
      status:           opts.status ?? "PENDING",
      templateCode:     opts.code,
      family:           opts.family ?? null,
      sourceEvent:      opts.sourceEvent ?? null,
    },
    select: { id: true },
  });
  return m.id;
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t;
  // The register module is normally side-effect-imported from
  // src/kernel/db/client.ts, but under vitest that import chain
  // sometimes doesn't fire — call directly to be safe.
  registerMilestoneListeners();
});

beforeEach(async () => {
  await db.milestone.deleteMany({});
  await db.project.deleteMany({});
});

describe("measurement.approved → auto-complete + stage advance", () => {
  it("ticks the MEASUREMENT milestone and advances stage to QUOTATION", async () => {
    const projectId = await makeProject(A.A, "MEASUREMENT");
    const milestoneId = await insertMilestone(A.A.orgId, projectId, {
      code: "MEASUREMENT",
      name: "Measurement",
      sourceEvent: "measurement.approved",
    });

    await bus.publish({
      type: "measurement.approved",
      orgId: A.A.orgId,
      actorId: A.A.userId,
      occurredAt: new Date(),
      measurementId: "mea-1",
      projectId,
    });

    const m = await db.milestone.findUnique({ where: { id: milestoneId } });
    expect(m?.status).toBe("COMPLETED");
    expect(m?.autoCompleted).toBe(true);

    const p = await db.project.findUnique({ where: { id: projectId } });
    expect(p?.stage).toBe("QUOTATION");
  });

  it("does not regress project.stage when already past QUOTATION", async () => {
    const projectId = await makeProject(A.A, "ORDERED");
    await insertMilestone(A.A.orgId, projectId, {
      code: "MEASUREMENT",
      name: "Measurement",
      sourceEvent: "measurement.approved",
    });

    await bus.publish({
      type: "measurement.approved",
      orgId: A.A.orgId,
      actorId: A.A.userId,
      occurredAt: new Date(),
      measurementId: "mea-1",
      projectId,
    });

    const p = await db.project.findUnique({ where: { id: projectId } });
    expect(p?.stage).toBe("ORDERED"); // untouched
  });
});

describe("advance.received — conditional completion", () => {
  it("does NOT complete when totalReceived < advanceRequired", async () => {
    const projectId = await makeProject(A.A, "QUOTATION");
    const msId = await insertMilestone(A.A.orgId, projectId, {
      code: "ADVANCE",
      name: "Advance",
      weight: 40,
      sourceEvent: "advance.received",
    });

    await bus.publish({
      type: "advance.received",
      orgId: A.A.orgId,
      actorId: A.A.userId,
      occurredAt: new Date(),
      advanceId: "adv-1",
      projectId,
      amountReceived: 5000_00n,          // ₹5,000
      totalReceivedForProject: 5000_00n, // still short
      advanceRequired: 20000_00n,        // needs ₹20,000
    });

    const m = await db.milestone.findUnique({ where: { id: msId } });
    expect(m?.status).toBe("PENDING");
    expect(m?.autoCompleted).toBe(false);
  });

  it("completes when totalReceived >= advanceRequired", async () => {
    const projectId = await makeProject(A.A, "QUOTATION");
    const msId = await insertMilestone(A.A.orgId, projectId, {
      code: "ADVANCE",
      name: "Advance",
      weight: 40,
      sourceEvent: "advance.received",
    });

    await bus.publish({
      type: "advance.received",
      orgId: A.A.orgId,
      actorId: A.A.userId,
      occurredAt: new Date(),
      advanceId: "adv-2",
      projectId,
      amountReceived: 20000_00n,
      totalReceivedForProject: 20000_00n,
      advanceRequired: 20000_00n,
    });

    const m = await db.milestone.findUnique({ where: { id: msId } });
    expect(m?.status).toBe("COMPLETED");
    expect(m?.autoCompleted).toBe(true);
  });
});
