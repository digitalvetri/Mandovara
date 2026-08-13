// §10 Integration — CalcResult recomputes and supersedes on dimension
// change; engineVersion is recorded on every result.
//
// Uses raw Prisma (no scoping) to isolate the DB behaviour from
// permission or context concerns. The action-level supersede is
// exercised end-to-end in tests/modules/measurement/*-actions.test.ts
// once the full server-action harness is wired.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { computeCalcResult } from "../../../src/modules/measurement/engine";

const db = new PrismaClient();
const ORG_ID = "test-org-msmt-supersede";
let branchId: string;
let projectId: string;
let roomId: string;
let measurementId: string;

beforeAll(async () => {
  // Fresh org + branch + client + project + room + round. All named
  // with a distinctive prefix so cleanup is deterministic.
  const org = await db.organization.upsert({
    where:  { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Supersede Test Org", settings: {} },
  });
  const branch = await db.branch.create({
    data: { organizationId: org.id, name: "HQ", invoicePrefix: "MDV" },
  });
  branchId = branch.id;
  const user = await db.user.create({
    data: {
      organizationId: org.id, name: "Test Measurer",
      mobile: `+91${Math.floor(1e9 + Math.random() * 9e9)}`, role: "OWNER",
      branchIds: [branch.id],
    },
  });
  const client = await db.client.create({
    data: {
      organizationId: org.id, code: `TST-${Date.now()}`, name: "Supersede Client",
      mobile: "+919999999999", billingAddress: {},
    },
  });
  const project = await db.project.create({
    data: {
      organizationId: org.id, branchId, number: `PRJ/TST-${Date.now()}`,
      name: "Supersede Villa", clientId: client.id, siteAddress: {}, ownerId: user.id,
    },
  });
  projectId = project.id;
  const room = await db.room.create({
    data: { organizationId: org.id, projectId, name: "Living" },
  });
  roomId = room.id;
  const round = await db.measurement.create({
    data: {
      organizationId: org.id, projectId, number: `MEA/TST-${Date.now()}`,
      visitedAt: new Date(), measuredById: user.id, status: "DRAFT",
    },
  });
  measurementId = round.id;
});

afterAll(async () => {
  // Cascade-safe cleanup: delete children first.
  await db.calcResult.deleteMany({ where: { organizationId: ORG_ID } });
  await db.measurementItem.deleteMany({ where: { organizationId: ORG_ID } });
  await db.measurement.deleteMany({ where: { organizationId: ORG_ID } });
  await db.room.deleteMany({ where: { organizationId: ORG_ID } });
  await db.project.deleteMany({ where: { organizationId: ORG_ID } });
  await db.client.deleteMany({ where: { organizationId: ORG_ID } });
  await db.user.deleteMany({ where: { organizationId: ORG_ID } });
  await db.branch.deleteMany({ where: { organizationId: ORG_ID } });
  await db.organization.deleteMany({ where: { id: ORG_ID } });
  await db.$disconnect();
});

describe("§10 integration · CalcResult supersedes on dimension change", () => {
  it("edit-then-recompute REPLACES CalcResult (not appends) and stamps a fresh engineVersion", async () => {
    // ── initial capture ───────────────────────────────────────────
    const v1 = { widthMm: 1800, heightMm: 2100, quantity: 1, family: "WALLPAPER" as const, deductions: [] };
    const calc1 = computeCalcResult(v1);

    const item = await db.measurementItem.create({
      data: {
        organizationId: ORG_ID, measurementId, roomId,
        label: "Feature Wall", surface: "WALL",
        widthMm: v1.widthMm, heightMm: v1.heightMm, quantity: v1.quantity,
        deductions: v1.deductions, family: v1.family, photoKeys: [],
      },
    });

    await db.calcResult.create({
      data: {
        organizationId:    ORG_ID,
        measurementItemId: item.id,
        engineVersion:     calc1.engineVersion,
        inputs:            calc1.inputs as object,
        materialQty:       calc1.materialQty,
        materialUnit:      calc1.materialUnit,
        rollsRequired:     calc1.rollsRequired ?? null,
        cutLengthMm:       calc1.cutLengthMm ?? null,
        areaSqft:          calc1.areaSqft ?? null,
        warnings:          calc1.warnings,
      },
    });

    const before = await db.calcResult.findMany({ where: { measurementItemId: item.id } });
    expect(before).toHaveLength(1);
    expect(before[0]!.engineVersion).toMatch(/^wallpaper@/);
    const originalMaterialQty = Number(before[0]!.materialQty);

    // ── edit dimensions → wider wall, materially more rolls needed ─
    const v2 = { ...v1, widthMm: 5400 };
    const calc2 = computeCalcResult(v2);
    expect(calc2.rollsRequired).toBeGreaterThan(calc1.rollsRequired!);

    // Supersede: delete old + insert new inside one transaction so
    // there is never a moment when the item has zero rows.
    await db.$transaction([
      db.measurementItem.update({
        where: { id: item.id },
        data:  { widthMm: v2.widthMm },
      }),
      db.calcResult.deleteMany({ where: { measurementItemId: item.id } }),
      db.calcResult.create({
        data: {
          organizationId:    ORG_ID,
          measurementItemId: item.id,
          engineVersion:     calc2.engineVersion,
          inputs:            calc2.inputs as object,
          materialQty:       calc2.materialQty,
          materialUnit:      calc2.materialUnit,
          rollsRequired:     calc2.rollsRequired ?? null,
          cutLengthMm:       calc2.cutLengthMm ?? null,
          areaSqft:          calc2.areaSqft ?? null,
          warnings:          calc2.warnings,
        },
      }),
    ]);

    const after = await db.calcResult.findMany({ where: { measurementItemId: item.id } });
    expect(after).toHaveLength(1);
    expect(after[0]!.id).not.toBe(before[0]!.id);                      // fresh row
    expect(after[0]!.engineVersion).toMatch(/^wallpaper@/);            // stamped
    expect(Number(after[0]!.materialQty)).toBeGreaterThan(originalMaterialQty); // reflects change
  }, 20_000);

  it("engineVersion is present on EVERY result — never null, never empty", async () => {
    const v = { widthMm: 3000, heightMm: 1200, quantity: 1, family: "CURTAIN_FABRIC" as const, headingType: "EYELET" as const, fullness: 2.5 };
    const calc = computeCalcResult(v);
    const item = await db.measurementItem.create({
      data: {
        organizationId: ORG_ID, measurementId, roomId,
        label: "Living curtain", surface: "WINDOW",
        widthMm: v.widthMm, heightMm: v.heightMm, quantity: v.quantity,
        family: v.family, headingType: v.headingType, fullness: v.fullness, photoKeys: [],
      },
    });
    await db.calcResult.create({
      data: {
        organizationId:    ORG_ID,
        measurementItemId: item.id,
        engineVersion:     calc.engineVersion,
        inputs:            calc.inputs as object,
        materialQty:       calc.materialQty,
        materialUnit:      calc.materialUnit,
        widthsRequired:    calc.widthsRequired ?? null,
        cutLengthMm:       calc.cutLengthMm ?? null,
        fabricRun:         calc.fabricRun ?? null,
        warnings:          calc.warnings,
      },
    });
    const row = await db.calcResult.findFirstOrThrow({ where: { measurementItemId: item.id } });
    expect(row.engineVersion).toBeTruthy();
    expect(row.engineVersion.length).toBeGreaterThan(3);
    expect(row.engineVersion).toContain("@");
  }, 20_000);
});
