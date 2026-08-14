"use server";

// Quick-quote flow (§ owner product flow, session 2026-08-14).
//
// Owner starts from a client, picks catalog items, enters rough
// dimensions the client relayed, and one action produces a full
// Quotation. To honour § 0.10 (no MTM quote line without a
// MeasurementItem), every quick-quote line auto-creates a
// PRELIMINARY MeasurementItem + CalcResult on the fly. A real
// on-site round can be added later and will supersede the
// preliminary via the standard revision chain.

import type { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { computeCalcResult } from "@/modules/measurement/engine";
import type { ActionResult } from "./actions";
import { quickQuoteSchema } from "./quick-schemas";

export async function createQuickQuote(
  input: unknown,
): Promise<ActionResult<{ quotationId: string; projectId: string; measurementId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.create");

  const parsed = quickQuoteSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const branch = await db.branch.findUnique({
    where:  { id: d.branchId },
    select: { id: true, invoicePrefix: true, stateCode: true },
  });
  if (!branch) return { ok: false, error: "Branch not found" };

  const client = await db.client.findUnique({
    where:  { id: d.clientId },
    select: { id: true, billingAddress: true },
  });
  if (!client) return { ok: false, error: "Client not found" };

  // ── Resolve colourways for GST rate + family ───────────────────
  const cwIds = d.lines.map((l) => l.colourwayId);
  const colourways = await db.colourway.findMany({
    where: { id: { in: cwIds } },
    select: {
      id: true, colourName: true, sellUnit: true,
      design: {
        select: {
          id: true, name: true, family: true, gstRate: true, hsn: true,
        },
      },
    },
  });
  const cwMap = new Map(colourways.map((c) => [c.id, c] as const));
  for (const l of d.lines) {
    if (!cwMap.has(l.colourwayId)) {
      return { ok: false, error: `Colourway ${l.colourwayId.slice(0, 8)}… not found or inactive.` };
    }
  }

  // ── Compute per-line tax and document totals up front ─────────
  const supplierStateCode = branch.stateCode;
  const placeOfSupplyCode = supplierStateCode; // quick quote defaults to same state
  const computed = d.lines.map((line, i) => {
    const cw = cwMap.get(line.colourwayId)!;
    const gstRate = Number(cw.design.gstRate);
    const ratePaise = parseINR(line.ratePaise);
    const qtyFixed  = BigInt(Math.round(line.quantity * 10_000));
    const gross     = (ratePaise * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(gross, line.discountPct);
    const tax = computeLineTax({ taxable, gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      input:    line,
      lineNo:   i + 1,
      cw,
      ratePaise,
      taxable,
      gstRate,
      cgst:     tax.cgst,
      sgst:     tax.sgst,
      igst:     tax.igst,
      amount:   taxable + tax.cgst + tax.sgst + tax.igst,
    };
  });
  const totals = computeDocumentTotals(
    computed.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode, placeOfSupplyCode },
  );

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(now.getDate() + d.validForDays);

  const result = await withTransaction(async (tx: TxClient) => {
    // ── Project ────────────────────────────────────────────────
    let projectId = d.projectId ?? "";
    if (!projectId) {
      const projNumber = await allocateNumber(tx, {
        orgId: ctx.orgId, series: "PRJ", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
      });
      const proj = await tx.project.create({
        data: {
          organizationId:   ctx.orgId,
          branchId:         branch.id,
          number:           projNumber,
          name:             d.newProjectName!.trim(),
          clientId:         d.clientId,
          stage:            "ENQUIRY",
          siteAddress:      client.billingAddress ?? {},
          ownerId:          ctx.userId,
        },
        select: { id: true },
      });
      projectId = proj.id;
    }

    // ── Preliminary measurement round ──────────────────────────
    const meaNumber = await allocateNumber(tx, {
      orgId: ctx.orgId, series: "MEA", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
    });
    const round = await tx.measurement.create({
      data: {
        organizationId: ctx.orgId,
        projectId,
        number:         meaNumber,
        visitedAt:      now,
        measuredById:   ctx.userId,
        status:         "DRAFT",
        notes:          "Preliminary — client-supplied dimensions from quick quote. Replace with an on-site round before make.",
      },
      select: { id: true },
    });

    // ── Rooms (idempotent by name within this project) ─────────
    const wantedNames = new Set(d.lines.map((l) => l.roomName.trim()));
    const existingRooms = await tx.room.findMany({
      where:  { projectId, name: { in: [...wantedNames] } },
      select: { id: true, name: true },
    });
    const roomIdByName = new Map(existingRooms.map((r) => [r.name, r.id]));
    for (const name of wantedNames) {
      if (roomIdByName.has(name)) continue;
      const created = await tx.room.create({
        data: { organizationId: ctx.orgId, projectId, name },
        select: { id: true, name: true },
      });
      roomIdByName.set(name, created.id);
    }

    // ── MeasurementItem + CalcResult per line ──────────────────
    const itemIdByLineIdx = new Map<number, string>();
    for (let i = 0; i < d.lines.length; i++) {
      const line = d.lines[i]!;
      const cw   = cwMap.get(line.colourwayId)!;
      const family = cw.design.family;
      const roomId = roomIdByName.get(line.roomName.trim())!;

      const item = await tx.measurementItem.create({
        data: {
          organizationId: ctx.orgId,
          measurementId:  round.id,
          roomId,
          label:          line.label,
          surface:        surfaceFromFamily(family),
          family,
          widthMm:        new Decimal(line.widthMm),
          heightMm:       new Decimal(line.heightMm),
          quantity:       Math.max(1, Math.round(line.quantity)),
          photoKeys:      [],
          notes:          "Preliminary — from quick quote.",
        },
        select: { id: true },
      });
      itemIdByLineIdx.set(i, item.id);

      const calc = computeCalcResult({
        family,
        widthMm:  line.widthMm,
        heightMm: line.heightMm,
        quantity: Math.max(1, Math.round(line.quantity)),
        ...(family === "WALLPAPER" && { deductions: [] }),
      });
      await tx.calcResult.create({
        data: {
          organizationId:    ctx.orgId,
          measurementItemId: item.id,
          engineVersion:     calc.engineVersion,
          inputs:            calc.inputs as object,
          materialQty:       new Decimal(calc.materialQty),
          materialUnit:      calc.materialUnit,
          widthsRequired:    calc.widthsRequired ?? null,
          cutLengthMm:       calc.cutLengthMm !== undefined ? new Decimal(calc.cutLengthMm) : null,
          rollsRequired:     calc.rollsRequired ?? null,
          boxesRequired:     calc.boxesRequired ?? null,
          areaSqft:          calc.areaSqft !== undefined ? new Decimal(calc.areaSqft) : null,
          wastagePct:        calc.wastagePct !== undefined ? new Decimal(calc.wastagePct) : null,
          fabricRun:         calc.fabricRun ?? null,
          liningQty:         calc.liningQty !== undefined ? new Decimal(calc.liningQty) : null,
          warnings:          calc.warnings,
        },
      });
    }

    // ── Quotation ──────────────────────────────────────────────
    const qtNumber = await allocateNumber(tx, {
      orgId: ctx.orgId, series: "QT", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
    });
    const q = await tx.quotation.create({
      data: {
        organizationId: ctx.orgId,
        branchId:       branch.id,
        number:         qtNumber,
        revision:       0,
        projectId,
        clientId:       d.clientId,
        date:           now,
        validUntil,
        status:         "DRAFT",
        taxableAmount:  totals.taxableAmount,
        cgst:           totals.cgst,
        sgst:           totals.sgst,
        igst:           totals.igst,
        roundOff:       totals.roundOff,
        total:          totals.total,
        ownerId:        ctx.userId,
        termsText:      (d.termsText ?? "").trim() || null,
      },
      select: { id: true },
    });

    await tx.quotationLine.createMany({
      data: computed.map((l) => {
        const itemId = itemIdByLineIdx.get(l.lineNo - 1)!;
        const line = l.input;
        return {
          organizationId:    ctx.orgId,
          quotationId:       q.id,
          lineNo:            l.lineNo,
          measurementItemId: itemId,
          roomLabel:         line.roomName.trim(),
          colourwayId:       line.colourwayId,
          description:       line.description?.trim() || `${l.cw.design.name} — ${l.cw.colourName}`,
          quantity:          new Decimal(line.quantity),
          unit:              l.cw.sellUnit,
          rate:              l.ratePaise,
          discountPct:       new Decimal(line.discountPct),
          taxable:           l.taxable,
          gstRate:           new Decimal(l.gstRate),
          cgst:              l.cgst,
          sgst:              l.sgst,
          igst:              l.igst,
          amount:            l.amount,
        };
      }),
    });

    return { quotationId: q.id, projectId, measurementId: round.id };
  });

  revalidatePath(`/clients/${d.clientId}`);
  revalidatePath(`/projects/${result.projectId}`);
  revalidatePath(`/quotations`);
  return { ok: true, data: result };
}

// ── helpers ────────────────────────────────────────────────────

function surfaceFromFamily(family: string): "WINDOW" | "WALL" | "FLOOR" | "CEILING" | "GLASS" | "FURNITURE" {
  if (family === "CURTAIN_FABRIC" || family === "SHEER" || family === "BLIND") return "WINDOW";
  if (family === "WALLPAPER") return "WALL";
  if (family === "FLOORING" || family === "CARPET_ROLL" || family === "CARPET_TILE") return "FLOOR";
  if (family === "INTERIOR_FILM") return "GLASS";
  if (family === "UPHOLSTERY_FABRIC" || family === "FOAM_FILLING") return "FURNITURE";
  return "WALL";
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
