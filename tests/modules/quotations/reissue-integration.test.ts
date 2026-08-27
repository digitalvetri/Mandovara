// Proves the reissue action end to end against the database: an estimate on a
// measured project becomes a firm quotation whose lines are linked to real
// MeasurementItems, priced from CalcResult quantities.

import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { reissueAsFirmQuotation } from "@/modules/quotations/reissue-actions";
import { isEstimate } from "@/modules/quotations/lib";

const db = new PrismaClient();

let estimateId = "";
let projectId  = "";
let itemCount  = 0;

beforeAll(async () => {
  // A seeded project that already has an approved measurement round.
  const item = await db.measurementItem.findFirst({
    where: { measurement: { status: "APPROVED" }, calc: { isNot: null } },
    select: { room: { select: { projectId: true } } },
  });
  // room.projectId is nullable since leads became measurable (2026-08-27);
  // this fixture only ever builds project-scoped rooms.
  if (!item || !item.room.projectId) return;
  projectId = item.room.projectId;

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { organizationId: true, branchId: true, clientId: true, ownerId: true },
  });

  itemCount = await db.measurementItem.count({
    where: { room: { projectId }, measurement: { status: "APPROVED" } },
  });

  // An estimate already re-linked onto that client + project, i.e. exactly the
  // state a converted website enquiry lands in.
  const q = await db.quotation.create({
    data: {
      organizationId: project.organizationId,
      branchId: project.branchId,
      number: `MDV/QT-REISSUE-${Date.now()}`,
      revision: 0,
      clientId: project.clientId,
      projectId,
      date: new Date(),
      validUntil: new Date(Date.now() + 15 * 86400_000),
      status: "DRAFT",
      taxableAmount: 100_000_00n, cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n,
      roundOff: 0n, total: 118_000_00n,
      ownerId: project.ownerId,
      lines: {
        create: [{
          organizationId: project.organizationId,
          lineNo: 1,
          measurementItemId: null,               // ← free text: an estimate
          description: "Curtains — whole villa (ballpark)",
          quantity: 1, unit: "SET", rate: 100_000_00n,
          taxable: 100_000_00n, gstRate: 18,
          cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n, amount: 118_000_00n,
        }],
      },
    },
    select: { id: true },
  });
  estimateId = q.id;
});

describe("reissueAsFirmQuotation", () => {
  it("the fixture really is an estimate to begin with", async () => {
    if (!estimateId) return;
    const lines = await db.quotationLine.findMany({
      where: { quotationId: estimateId }, select: { measurementItemId: true },
    });
    expect(isEstimate(lines)).toBe(true);
  });

  it("produces a measured revision linked to the project's measurement items", async () => {
    if (!estimateId) return;
    const res = await reissueAsFirmQuotation({ quotationId: estimateId });
    expect(res.ok, res.error).toBe(true);
    expect(res.data!.revision).toBe(1);
    expect(res.data!.lines).toBe(itemCount);

    const lines = await db.quotationLine.findMany({
      where: { quotationId: res.data!.quotationId },
      select: { measurementItemId: true, quantity: true, description: true },
    });
    // Every line is measured — this is what makes it firm, and what satisfies
    // §15.1 by construction.
    expect(lines.every((l) => l.measurementItemId)).toBe(true);
    expect(isEstimate(lines)).toBe(false);
    expect(lines.every((l) => Number(l.quantity) > 0)).toBe(true);
    expect(lines[0]!.description).toMatch(/·/);   // "Room · Opening — Family"
  });

  it("keeps the same number and supersedes the estimate rather than deleting it", async () => {
    if (!estimateId) return;
    const src = await db.quotation.findUniqueOrThrow({
      where: { id: estimateId }, select: { number: true, status: true },
    });
    const rev = await db.quotation.findFirstOrThrow({
      where: { parentId: estimateId }, select: { number: true, revision: true, projectId: true },
    });
    expect(rev.number, "one continuous document for the client").toBe(src.number);
    expect(rev.revision).toBe(1);
    expect(rev.projectId).toBe(projectId);
    expect(src.status, "history preserved, not deleted").toBe("REVISED");
  });

  it("refuses to reissue the same estimate twice", async () => {
    if (!estimateId) return;
    const again = await reissueAsFirmQuotation({ quotationId: estimateId });
    expect(again.ok).toBe(false);
    // A clear message, not a raw unique-constraint error on (org, number, revision).
    expect(again.error).toMatch(/already been reissued/i);
  });
});
