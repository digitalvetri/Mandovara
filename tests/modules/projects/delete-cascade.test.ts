// Deleting a project must actually delete it, and must not take anything
// with it that belongs to somebody else.
//
// Fourteen tables carry a projectId with no foreign key at all, and most
// of the eleven that do have one carry no ON DELETE rule — so a
// mis-ordered statement here is a P2003 at runtime, and a *missing*
// statement is worse: Postgres neither blocks nor cascades, the delete
// reports success, and MeasurementItem rows survive pointing at a round
// that no longer exists. Neither shows up in a type-check.
//
// This runs the real deleteProjectChildren() against a real database,
// for the same reason measurement-item-delete.test.ts exists: the rule
// being tested lives in Postgres, not in TypeScript.

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma as db } from "@/kernel/db/client";
import { deleteProjectChildren } from "@/modules/projects/delete-cascade";

let seq = 0;

/** A project with one of everything the cascade is meant to remove, plus
 *  an attendance punch and a WhatsApp thread it must only detach. */
async function makeProject() {
  const n = `${Date.now()}-${seq++}`;
  const org = await db.organization.create({
    data: { name: `PrjDelOrg-${n}`, stateCode: "33", settings: {} as Prisma.InputJsonValue },
  });
  const branch = await db.branch.create({
    data: {
      organizationId: org.id, name: "Main",
      stateCode: "33", invoicePrefix: "MDV", address: {} as Prisma.InputJsonValue,
    },
  });
  const user = await db.user.create({
    data: {
      organizationId: org.id, mobile: `+9198${String(n).slice(-8)}`,
      name: "PrjDel", role: "OWNER", branchIds: [branch.id], status: "ACTIVE",
    },
  });
  const client = await db.client.create({
    data: {
      organizationId: org.id, code: `CL-${n}`,
      name: "Del Client", mobile: "+919000000001", ownerId: user.id,
      billingAddress: {} as Prisma.InputJsonValue,
    },
  });
  const project = await db.project.create({
    data: {
      organizationId: org.id, branchId: branch.id, number: `PRJ-${n}`,
      name: "Del Project", clientId: client.id, ownerId: user.id,
      siteAddress: {} as Prisma.InputJsonValue,
    },
  });

  const round = await db.measurement.create({
    data: {
      organizationId: org.id, projectId: project.id, number: `MEA-PD-${n}`,
      visitedAt: new Date(), measuredById: user.id,
    },
  });
  const room = await db.room.create({
    data: { organizationId: org.id, projectId: project.id, name: "Hall" },
  });
  const item = await db.measurementItem.create({
    data: {
      organizationId: org.id, measurementId: round.id, roomId: room.id,
      label: "East window", surface: "WINDOW",
      widthMm: new Prisma.Decimal("1524"), heightMm: new Prisma.Decimal("2438.4"),
      quantity: 1, family: "CURTAIN_FABRIC",
      headingType: "PINCH_PLEAT", fullness: new Prisma.Decimal("2"), photoKeys: [],
    },
  });
  // The RESTRICT-turned-CASCADE relation that broke the measurement
  // delete once already — it has to survive the project delete too.
  await db.calcResult.create({
    data: {
      organizationId: org.id, measurementItemId: item.id, engineVersion: "test",
      inputs: {} as Prisma.InputJsonValue,
      materialQty: new Prisma.Decimal("1"), materialUnit: "METRE", warnings: [],
    },
  });
  const milestone = await db.milestone.create({
    data: {
      organizationId: org.id, projectId: project.id, name: "Site Visit",
      plannedDate: new Date(), billingPct: new Prisma.Decimal("0"), order: 1,
    },
  });
  await db.siteLog.create({
    data: {
      organizationId: org.id, projectId: project.id, loggedAt: new Date(),
      summary: "Poured slab", createdById: user.id,
    },
  });
  await db.projectMember.create({
    data: { organizationId: org.id, projectId: project.id, userId: user.id, roleOnProject: "LEAD" },
  });
  // Detach-not-delete: an attendance punch belongs to the employee.
  const employee = await db.employee.create({
    data: {
      organizationId: org.id, code: `E-${String(n).slice(-6)}`,
      name: "Punch Person", mobile: "+919000000002", doj: new Date(),
      designation: "Fitter", department: "Installation",
    },
  });
  const punch = await db.attendance.create({
    data: {
      organizationId: org.id, employeeId: employee.id, date: new Date(),
      projectId: project.id, status: "PRESENT",
    },
  });

  return { org, branch, user, client, project, round, room, item, milestone, punch };
}

async function run(projectId: string) {
  await db.$transaction(async (tx) => {
    await deleteProjectChildren(tx as never, projectId);
    await tx.project.delete({ where: { id: projectId } });
  });
}

describe("project delete cascade", () => {
  it("removes the project and every child it owns", async () => {
    const f = await makeProject();

    await run(f.project.id);

    expect(await db.project.findUnique({ where: { id: f.project.id } })).toBeNull();
    // The orphan cases — no foreign key would have caught any of these.
    expect(await db.measurementItem.count({ where: { measurementId: f.round.id } })).toBe(0);
    expect(await db.measurementItem.count({ where: { roomId: f.room.id } })).toBe(0);
    expect(await db.calcResult.count({ where: { measurementItemId: f.item.id } })).toBe(0);
    expect(await db.measurement.count({ where: { projectId: f.project.id } })).toBe(0);
    expect(await db.room.count({ where: { projectId: f.project.id } })).toBe(0);
    expect(await db.milestone.count({ where: { id: f.milestone.id } })).toBe(0);
    expect(await db.siteLog.count({ where: { projectId: f.project.id } })).toBe(0);
    expect(await db.projectMember.count({ where: { projectId: f.project.id } })).toBe(0);
  });

  it("detaches an attendance punch instead of deleting it", async () => {
    const f = await makeProject();

    await run(f.project.id);

    const punch = await db.attendance.findUnique({ where: { id: f.punch.id } });
    expect(punch).not.toBeNull();
    expect(punch?.projectId).toBeNull();
  });

  it("keeps a quotation that came from a lead, and unhooks it", async () => {
    const f = await makeProject();
    const lead = await db.lead.create({
      data: {
        organizationId: f.org.id, number: `LD-${Date.now()}-${seq++}`, name: "Del Lead",
        mobile: "+919000000003", source: "WALK_IN", ownerId: f.user.id,
      },
    });
    const fromLead = await db.quotation.create({
      data: {
        organizationId: f.org.id, branchId: f.branch.id, number: `QT-L-${Date.now()}-${seq++}`,
        // leadId XOR clientId (quotation_party_xor, migration
        // 20260816172545) — a lead-origin quote carries no client, but
        // may still be attached to the project it later fed.
        leadId: lead.id, projectId: f.project.id,
        date: new Date(), validUntil: new Date(), total: 0n, ownerId: f.user.id,
      },
    });
    const fromProject = await db.quotation.create({
      data: {
        organizationId: f.org.id, branchId: f.branch.id, number: `QT-P-${Date.now()}-${seq++}`,
        clientId: f.client.id, projectId: f.project.id,
        date: new Date(), validUntil: new Date(), total: 0n, ownerId: f.user.id,
      },
    });

    await run(f.project.id);

    const kept = await db.quotation.findUnique({ where: { id: fromLead.id } });
    expect(kept).not.toBeNull();
    expect(kept?.projectId).toBeNull();
    expect(await db.quotation.findUnique({ where: { id: fromProject.id } })).toBeNull();
  });
});
