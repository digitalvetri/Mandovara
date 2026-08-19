"use server";
/* eslint-disable max-lines -- FIXME(§10): 346 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */

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
import type { ProductFamily, SellUnit } from "@prisma/client";
import { findMeasurementGateViolation } from "./lib";
import type { ActionResult } from "./actions";
import { quickQuoteSchema } from "./quick-schemas";

export async function createQuickQuote(
  input: unknown,
): Promise<ActionResult<{ quotationId: string; projectId: string | null; measurementId: string | null }>> {
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

  // FIXES-01 §5.1 — lead-scoped quick quote never touches Client / Project.
  // The party stays a lead until an explicit "Convert to Client" step.
  const isLeadScoped = !!d.leadId;
  let client: { id: string; billingAddress: unknown } | null = null;
  if (isLeadScoped) {
    const lead = await db.lead.findUnique({
      where:  { id: d.leadId! },
      select: { id: true },
    });
    if (!lead) return { ok: false, error: "Lead not found" };
  } else {
    client = await db.client.findUnique({
      where:  { id: d.clientId! },
      select: { id: true, billingAddress: true },
    });
    if (!client) return { ok: false, error: "Client not found" };
  }

  // ── Resolve colourways for GST rate + family (only for catalog lines) ─
  const cwIds = d.lines.map((l) => l.colourwayId).filter((id): id is string => !!id);
  const colourways = cwIds.length > 0
    ? await db.colourway.findMany({
        where: { id: { in: cwIds } },
        select: {
          id: true, colourName: true, sellUnit: true,
          design: { select: { id: true, name: true, family: true, gstRate: true, hsn: true } },
        },
      })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c] as const));
  for (const l of d.lines) {
    if (l.colourwayId && !cwMap.has(l.colourwayId)) {
      return { ok: false, error: `Colourway ${l.colourwayId.slice(0, 8)}… not found or inactive.` };
    }
  }

  // ── §0.10 / §15.1 measurement gate ─────────────────────────────
  // Client-scoped quick quotes auto-create a preliminary Measurement round
  // below, so every line gets a real measurementItemId. Lead-scoped quotes
  // have no Project to hang a round off — so rather than writing a
  // made-to-measure line with measurementItemId = null (exactly what §15.1
  // forbids, with no exception), refuse it and name the next action.
  if (isLeadScoped) {
    // Gate only applies to catalog lines — free-text lines (no colourwayId) have
    // no known family and are treated as service / accessory items.
    const violation = findMeasurementGateViolation(
      d.lines,
      (id) => cwMap.get(id)?.design.family as ProductFamily | undefined,
      { isLeadScoped: true, labelOf: (id) => cwMap.get(id)?.design.name },
    );
    if (violation) {
      return {
        ok: false,
        errorCode: "MEASUREMENT_REQUIRED",
        error: "Validation failed",
        fieldErrors: { [`lines.${violation.index}.colourwayId`]: violation.message },
      };
    }
  }

  // ── Compute per-line tax and document totals up front ─────────
  const supplierStateCode = branch.stateCode;
  const placeOfSupplyCode = supplierStateCode; // quick quote defaults to same state
  const computed = d.lines.map((line, i) => {
    const cw = line.colourwayId ? cwMap.get(line.colourwayId) : undefined;
    const gstRate = cw ? Number(cw.design.gstRate) : (line.gstRate ?? 18);
    const ratePaise = parseINR(line.ratePaise);
    const qtyFixed  = BigInt(Math.round(line.quantity * 10_000));
    const gross     = (ratePaise * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(gross, line.discountPct);
    const tax = computeLineTax({ taxable, gstRate, supplierStateCode, placeOfSupplyCode });
    return {
      input:    line,
      lineNo:   i + 1,
      cw:       cw ?? null,
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
    // ── Project (client-scoped only; lead-scoped skips) ────────
    let projectId: string | null = null;
    if (!isLeadScoped) {
      projectId = d.projectId ?? null;
      if (!projectId) {
        const projNumber = await allocateNumber(tx, {
          orgId: ctx.orgId, series: "PRJ", yymm: yymmFromDate(now), prefix: branch.invoicePrefix,
        });
        const siteAddress = (client?.billingAddress ?? {}) as object;
        const proj = await tx.project.create({
          data: {
            organizationId:   ctx.orgId,
            branchId:         branch.id,
            number:           projNumber,
            name:             d.newProjectName!.trim(),
            clientId:         d.clientId!,
            stage:            "ENQUIRY",
            siteAddress,
            ownerId:          ctx.userId,
          },
          select: { id: true },
        });
        projectId = proj.id;
      }
    }

    // ── Measurement + Rooms + Items (client-scoped only) ───────
    // Lead-scoped quotations are pre-conversion estimates — no project
    // to hang measurements off, and the calc engine's warnings/rolls
    // land on the client-side line preview only. When the lead converts,
    // a proper on-site measurement round supersedes.
    let measurementId: string | null = null;
    const itemIdByLineIdx = new Map<number, string>();
    if (!isLeadScoped && projectId) {
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
      measurementId = round.id;

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

      for (let i = 0; i < d.lines.length; i++) {
        const line = d.lines[i]!;
        if (!line.colourwayId) continue;   // free-text lines need no measurement item
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
        leadId:         isLeadScoped ? d.leadId! : null,
        clientId:       isLeadScoped ? null : d.clientId!,
        projectId,
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
        // measurementItemId is null for lead-scoped lines (no measurement
        // round exists yet — a real round supersedes at conversion).
        const itemId = itemIdByLineIdx.get(l.lineNo - 1) ?? null;
        const line = l.input;
        return {
          organizationId:    ctx.orgId,
          quotationId:       q.id,
          lineNo:            l.lineNo,
          measurementItemId: itemId,
          roomLabel:         line.roomName.trim(),
          colourwayId:       line.colourwayId ?? null,
          description:       line.description?.trim() ||
            (l.cw ? `${l.cw.design.name} — ${l.cw.colourName}` : line.label.trim()),
          quantity:          new Decimal(line.quantity),
          unit:              (l.cw?.sellUnit ?? line.unit) as SellUnit,
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

    return { quotationId: q.id, projectId, measurementId };
  });

  if (isLeadScoped) revalidatePath(`/leads/${d.leadId!}`);
  else              revalidatePath(`/clients/${d.clientId!}`);
  if (result.projectId) revalidatePath(`/projects/${result.projectId}`);
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
