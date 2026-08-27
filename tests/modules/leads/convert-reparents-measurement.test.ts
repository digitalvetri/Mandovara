// convertLead must carry a lead's measurement forward, not strand it.
//
// Leads became measurable on 2026-08-27 (Room.leadId / Measurement.leadId,
// party XOR). The whole value of that is this moment: a prospect's site is
// measured, the prospect says yes, and the dimensions taken on that visit
// become the project's dimensions WITHOUT anyone re-typing them.
//
// The failure this guards against is subtle and silent. Rooms and rounds
// are reparented by two separate updateMany calls. If only one ran — a
// future edit splitting the transaction, an early return between them —
// you would get a MeasurementItem whose Room belongs to the new Project
// while its Measurement still belongs to the dead Lead. Nothing throws.
// listItemsForFirmQuote would return nothing for the project, the cut
// list would come out empty, and the first person to notice would be a
// tailor with no job card.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;

const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { convertLead } = await import("@/modules/leads/actions-part2");

function rand(): string { return Math.random().toString(36).slice(2, 8); }

/** A lead with one room, one APPROVED round and one measured item on it. */
async function measuredLead(t: Tenant): Promise<{ leadId: string; roomId: string; roundId: string; itemId: string }> {
  const lead = await db.lead.create({
    data: {
      organizationId: t.orgId,
      number:  `MDV/ENQ-2608-${rand()}`,
      name:    "Dr Kannan",
      mobile:  "+919000000042",
      source:  "WALK_IN",
      ownerId: t.userId,
    },
    select: { id: true },
  });

  const room = await db.room.create({
    data: { organizationId: t.orgId, leadId: lead.id, name: "Master Bedroom", sortOrder: 10 },
    select: { id: true },
  });

  const round = await db.measurement.create({
    data: {
      organizationId: t.orgId,
      leadId:         lead.id,
      number:         `MDV/MEA-2608-${rand()}`,
      visitedAt:      new Date(),
      measuredById:   t.userId,
      status:         "APPROVED",
    },
    select: { id: true },
  });

  const item = await db.measurementItem.create({
    data: {
      organizationId: t.orgId,
      measurementId:  round.id,
      roomId:         room.id,
      label:          "Window 1 — East",
      surface:        "WINDOW",
      widthMm:        "1800.00",
      heightMm:       "2100.00",
      quantity:       1,
      family:         "CURTAIN_FABRIC",
      headingType:    "EYELET",
      fullness:       "2.50",
    },
    select: { id: true },
  });

  return { leadId: lead.id, roomId: room.id, roundId: round.id, itemId: item.id };
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([...A.ctx.permissions, "lead.convert", "project.create"]),
  };
});

beforeEach(async () => {
  await db.measurementItem.deleteMany({});
  await db.measurement.deleteMany({});
  await db.room.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
  await db.lead.deleteMany({});
});

describe("convertLead — measurement carries forward", () => {
  it("re-points the lead's rooms and rounds at the new project", async () => {
    const { leadId, roomId, roundId } = await measuredLead(A);

    const res = await convertLead({ id: leadId, billingCity: "Coimbatore" });
    expect(res.ok).toBe(true);
    const projectId = res.data?.projectId;
    expect(projectId).toBeTruthy();

    const room  = await db.room.findUniqueOrThrow({ where: { id: roomId } });
    const round = await db.measurement.findUniqueOrThrow({ where: { id: roundId } });

    expect(room.projectId).toBe(projectId);
    expect(room.leadId).toBeNull();
    expect(round.projectId).toBe(projectId);
    expect(round.leadId).toBeNull();
  });

  it("keeps the item, its room and its round on the SAME project", async () => {
    // The coherence check. Two updateMany calls moved these rows; this
    // asserts they landed together rather than half-migrating.
    const { leadId, itemId } = await measuredLead(A);

    const res = await convertLead({ id: leadId, billingCity: "Coimbatore" });
    const projectId = res.data?.projectId;

    const item = await db.measurementItem.findUniqueOrThrow({
      where:  { id: itemId },
      select: { room: { select: { projectId: true } }, measurement: { select: { projectId: true } } },
    });

    expect(item.room.projectId).toBe(projectId);
    expect(item.measurement.projectId).toBe(projectId);
    expect(item.room.projectId).toBe(item.measurement.projectId);
  });

  it("preserves the measured dimensions exactly — nothing is re-entered", async () => {
    const { leadId, itemId } = await measuredLead(A);
    await convertLead({ id: leadId, billingCity: "Coimbatore" });

    const item = await db.measurementItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.widthMm.toString()).toBe("1800");
    expect(item.heightMm.toString()).toBe("2100");
    expect(item.fullness?.toString()).toBe("2.5");
    expect(item.headingType).toBe("EYELET");
  });

  it("leaves no row owned by the dead lead", async () => {
    const { leadId } = await measuredLead(A);
    await convertLead({ id: leadId, billingCity: "Coimbatore" });

    expect(await db.room.count({ where: { leadId } })).toBe(0);
    expect(await db.measurement.count({ where: { leadId } })).toBe(0);
  });

  it("is idempotent — converting twice does not fork the project", async () => {
    const { leadId, roundId } = await measuredLead(A);

    const first  = await convertLead({ id: leadId, billingCity: "Coimbatore" });
    const second = await convertLead({ id: leadId, billingCity: "Coimbatore" });

    expect(second.ok).toBe(true);
    expect(second.data?.projectId).toBe(first.data?.projectId);

    const round = await db.measurement.findUniqueOrThrow({ where: { id: roundId } });
    expect(round.projectId).toBe(first.data?.projectId);
  });
});

describe("party XOR — enforced by the database, not the form", () => {
  it("refuses a room belonging to both a project and a lead", async () => {
    const { leadId } = await measuredLead(A);
    const res = await convertLead({ id: leadId, billingCity: "Coimbatore" });
    const projectId = res.data?.projectId ?? "";

    // The lead is converted, so re-using its id alongside a real project
    // is exactly the half-migrated shape the CHECK constraint exists to
    // make impossible.
    await expect(db.room.create({
      data: { organizationId: A.orgId, projectId, leadId, name: "Both", sortOrder: 10 },
    })).rejects.toThrow();
  });

  it("refuses a measurement round belonging to neither", async () => {
    await expect(db.measurement.create({
      data: {
        organizationId: A.orgId,
        number:         `MDV/MEA-2608-${rand()}`,
        visitedAt:      new Date(),
        measuredById:   A.userId,
        status:         "DRAFT",
      },
    })).rejects.toThrow();
  });
});
