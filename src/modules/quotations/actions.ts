"use server";

import { z } from "zod";
import type { ProductFamily } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";
import { findMeasurementGateViolation } from "./lib";
import { createQuotationSchema, setStatusSchema, quotationLineInput, type QuotationLineInput } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
}

export async function createQuotation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.create");

  const parsed = createQuotationSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const d = parsed.data;

  const date = new Date(d.date);
  const validUntil = new Date(d.validUntil);
  if (validUntil <= date) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { validUntil: "Valid until must be after the quotation date" },
    };
  }

  const db = scoped(ctx);

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: d.branchId },
    select: { id: true, invoicePrefix: true, stateCode: true },
  });

  // Party resolution: EITHER a lead OR a (client, maybe project). The
  // schema refine already asserted XOR — narrow into concrete IDs here.
  let quoteLeadId:    string | null = null;
  let quoteClientId:  string | null = null;
  let quoteProjectId: string | null = null;
  if (d.leadId) {
    const lead = await db.lead.findUnique({ where: { id: d.leadId }, select: { id: true } });
    if (!lead) return { ok: false, error: "Lead not found" };
    quoteLeadId = lead.id;
  } else if (d.projectId) {
    const project = await db.project.findUniqueOrThrow({
      where:  { id: d.projectId },
      select: { id: true, clientId: true },
    });
    quoteProjectId = project.id;
    quoteClientId  = d.clientId ?? project.clientId;
  } else if (d.clientId) {
    const client = await db.client.findUnique({ where: { id: d.clientId }, select: { id: true } });
    if (!client) return { ok: false, error: "Client not found" };
    quoteClientId = client.id;
  }

  // Fetch colourway → design for measurement gate and GST rate resolution
  const colourwayIds = d.lines
    .map((l) => l.colourwayId)
    .filter((id): id is string => typeof id === "string");

  const colourways = colourwayIds.length > 0
    ? await db.colourway.findMany({
        where: { id: { in: colourwayIds } },
        select: {
          id: true,
          design: { select: { family: true, gstRate: true } },
        },
      })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c]));

  // § 0.10 / § 15.1 — server-side measurement gate. Applies to EVERY quote,
  // lead-scoped or not: the non-negotiable has no exception. A lead-scoped
  // quote simply cannot carry a made-to-measure line, because there is no
  // project to hang a measurement round off — the user must convert the lead
  // first. Hardware, motors, accessories and service remain quotable.
  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    if (line.colourwayId && !cwMap.get(line.colourwayId)) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { [`lines.${i}.colourwayId`]: "Colourway not found" },
      };
    }
  }
  {
    const violation = findMeasurementGateViolation(
      d.lines,
      (id) => cwMap.get(id)?.design.family as ProductFamily | undefined,
      { isLeadScoped: !!quoteLeadId },
    );
    if (violation) {
      return {
        ok: false,
        errorCode: "MEASUREMENT_REQUIRED",
        error: "Validation failed",
        fieldErrors: { [`lines.${violation.index}.measurementItemId`]: violation.message },
      };
    }
  }

  // Compute taxes server-side; client-submitted tax values are ignored
  type ComputedLine = {
    input: QuotationLineInput;
    ratePaise: bigint;
    taxable: bigint;
    cgst: bigint;
    sgst: bigint;
    igst: bigint;
    amount: bigint;
    gstRate: number;
    lineNo: number;
  };

  const computedLines: ComputedLine[] = [];

  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    const ratePaise = parseINR(line.rate);
    const qtyFixed = BigInt(Math.round(line.quantity * 10_000));
    const grossPaise = (ratePaise * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(grossPaise, line.discountPct ?? 0);

    // GST rate: from design when colourway set (authoritative); else line input
    let gstRate = line.gstRate;
    if (line.colourwayId) {
      const cw = cwMap.get(line.colourwayId);
      if (cw) gstRate = Number(cw.design.gstRate);
    }

    const tax = computeLineTax({
      taxable,
      gstRate,
      supplierStateCode: branch.stateCode,
      placeOfSupplyCode: d.placeOfSupplyCode,
    });
    computedLines.push({
      input: line,
      ratePaise,
      taxable,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      amount: taxable + tax.cgst + tax.sgst + tax.igst,
      gstRate,
      lineNo: i + 1,
    });
  }

  const totals = computeDocumentTotals(
    computedLines.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode: branch.stateCode, placeOfSupplyCode: d.placeOfSupplyCode },
  );

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "QT",
      yymm:   yymmFromDate(date),
      prefix: branch.invoicePrefix,
    });
    const q = await tx.quotation.create({
      data: {
        organizationId: ctx.orgId,
        branchId:       branch.id,
        number,
        revision:       0,
        leadId:         quoteLeadId,
        clientId:       quoteClientId,
        projectId:      quoteProjectId,
        date,
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
      data: computedLines.map((l) => ({
        organizationId:    ctx.orgId,
        quotationId:       q.id,
        lineNo:            l.lineNo,
        measurementItemId: l.input.measurementItemId ?? null,
        roomLabel:         (l.input.roomLabel ?? "").trim() || null,
        colourwayId:       l.input.colourwayId ?? null,
        serviceRateId:     l.input.serviceRateId ?? null,
        description:       l.input.description.trim(),
        quantity:          new Decimal(l.input.quantity),
        unit:              l.input.unit,
        rate:              l.ratePaise,
        discountPct:       new Decimal(l.input.discountPct ?? 0),
        taxable:           l.taxable,
        gstRate:           new Decimal(l.gstRate),
        cgst:              l.cgst,
        sgst:              l.sgst,
        igst:              l.igst,
        amount:            l.amount,
        isOptional:        l.input.isOptional ?? false,
      })),
    });
    return q;
  }, { orgId: ctx.orgId });

  revalidatePath("/quotations");
  revalidatePath(`/projects/${d.projectId}`);
  return { ok: true, data: { id: created.id } };
}

export async function setQuotationStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  // Permission depends on the target state
  if (status === "SENT") {
    requirePermission(ctx, "quotation.send");
  } else if (status === "APPROVED") {
    requirePermission(ctx, "quotation.approve");
  } else {
    requirePermission(ctx, "quotation.update");
  }

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where: { id },
    select: { id: true, status: true, clientId: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };

  // Valid from → to transitions
  const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT:            ["PENDING_APPROVAL", "SENT"],
    PENDING_APPROVAL: ["APPROVED", "DRAFT"],
    APPROVED:         ["SENT"],
    SENT:             ["VIEWED", "ACCEPTED", "REJECTED"],
    VIEWED:           ["ACCEPTED", "REJECTED"],
    ACCEPTED:         [],
    REJECTED:         [],
    REVISED:          ["PENDING_APPROVAL", "SENT"],
    EXPIRED:          [],
  };
  const allowed = VALID_TRANSITIONS[q.status] ?? [];
  if (!allowed.includes(status)) {
    return { ok: false, error: `Cannot move from ${q.status} to ${status}` };
  }

  // When sending, freeze CalcResult snapshots onto each line (§7.7 rule 4 / §15.3)
  if (status === "SENT") {
    const lines = await db.quotationLine.findMany({
      where: { quotationId: id, measurementItemId: { not: null } },
      select: { id: true, measurementItemId: true },
    });
    if (lines.length > 0) {
      const calcResults = await db.calcResult.findMany({
        where: {
          measurementItemId: {
            in: lines.map((l) => l.measurementItemId!).filter(Boolean),
          },
        },
      });
      const calcMap = new Map(calcResults.map((c) => [c.measurementItemId, c]));
      for (const line of lines) {
        const calc = calcMap.get(line.measurementItemId!);
        if (!calc) continue;
        const snapshot = {
          id: calc.id,
          engineVersion: calc.engineVersion,
          materialQty: calc.materialQty.toString(),
          materialUnit: calc.materialUnit,
          widthsRequired: calc.widthsRequired,
          cutLengthMm: calc.cutLengthMm?.toString() ?? null,
          rollsRequired: calc.rollsRequired,
          boxesRequired: calc.boxesRequired,
          areaSqft: calc.areaSqft?.toString() ?? null,
          billableAreaSqft: calc.billableAreaSqft?.toString() ?? null,
          wastagePct: calc.wastagePct?.toString() ?? null,
          fabricRun: calc.fabricRun,
          seamCount: calc.seamCount,
          liningQty: calc.liningQty?.toString() ?? null,
          warnings: calc.warnings,
          computedAt: calc.computedAt.toISOString(),
        };
        await db.quotationLine.update({
          where: { id: line.id },
          data: { calcSnapshot: snapshot },
        });
      }
    }
  }

  await db.quotation.update({
    where: { id },
    data: {
      status,
      ...(status === "SENT"             ? { sentAt: new Date() }                                                  : {}),
      ...(status === "PENDING_APPROVAL" ? { submittedById: ctx.userId, submittedAt: new Date() }                 : {}),
      ...(status === "APPROVED"         ? { approvedById: ctx.userId, approvedAt: new Date(), rejectionReason: null } : {}),
      ...(status === "DRAFT" && q.status === "PENDING_APPROVAL"
                                        ? { rejectionReason: "Returned to draft by approver" }                   : {}),
    },
  });

  // Fire domain events after successful state transition. Listeners in
  // kernel/milestones handle milestone auto-completion and stage advance
  // (see onQuotationAccepted). clientId is nullable now for lead-scoped
  // quotes — the event's clientId falls back to empty string, and the
  // listener guards on projectId before doing anything project-specific.
  if (status === "ACCEPTED") {
    await bus.publish({
      type:        "quotation.accepted",
      orgId:       ctx.orgId,
      actorId:     ctx.userId,
      occurredAt:  new Date(),
      quotationId: id,
      clientId:    q.clientId ?? "",
    });
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true, data: { id } };
}

export async function rejectQuotation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.approve");

  const parsed = z
    .object({ id: z.string().min(1), reason: z.string().trim().min(1).max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required" };
  const { id, reason } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({ where: { id }, select: { status: true } });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (q.status !== "PENDING_APPROVAL") {
    return { ok: false, error: "Only pending-approval quotations can be rejected" };
  }

  await db.quotation.update({
    where: { id },
    data: { status: "DRAFT", rejectionReason: reason },
  });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true, data: { id } };
}

export async function updateQuotationLines(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.update");

  const parsed = z
    .object({
      quotationId:       z.string().min(1),
      placeOfSupplyCode: z.string().length(2, "2-digit state code required"),
      lines:             z.array(quotationLineInput).min(1, "At least one line is required"),
    })
    .safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const q = await db.quotation.findUnique({
    where: { id: d.quotationId },
    select: { id: true, status: true, branchId: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (!["DRAFT", "REVISED"].includes(q.status)) {
    return { ok: false, error: "Only DRAFT quotations can have their lines edited" };
  }

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: q.branchId },
    select: { stateCode: true },
  });

  const colourwayIds = d.lines
    .map((l) => l.colourwayId)
    .filter((id): id is string => typeof id === "string");

  const colourways = colourwayIds.length > 0
    ? await db.colourway.findMany({
        where: { id: { in: colourwayIds } },
        select: { id: true, design: { select: { family: true, gstRate: true } } },
      })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c]));

  {
    const violation = findMeasurementGateViolation(
      d.lines,
      (id) => cwMap.get(id)?.design.family as ProductFamily | undefined,
      { isLeadScoped: false },
    );
    if (violation) {
      return {
        ok: false,
        errorCode: "MEASUREMENT_REQUIRED",
        error: "Validation failed",
        fieldErrors: { [`lines.${violation.index}.measurementItemId`]: violation.message },
      };
    }
  }

  type ComputedLine = {
    input: QuotationLineInput;
    ratePaise: bigint;
    taxable: bigint;
    cgst: bigint;
    sgst: bigint;
    igst: bigint;
    amount: bigint;
    gstRate: number;
    lineNo: number;
  };

  const computedLines: ComputedLine[] = [];
  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    const ratePaise = parseINR(line.rate);
    const qtyFixed = BigInt(Math.round(line.quantity * 10_000));
    const grossPaise = (ratePaise * qtyFixed) / 10_000n;
    const { taxable } = applyLineDiscount(grossPaise, line.discountPct ?? 0);

    let gstRate = line.gstRate;
    if (line.colourwayId) {
      const cw = cwMap.get(line.colourwayId);
      if (cw) gstRate = Number(cw.design.gstRate);
    }
    const tax = computeLineTax({
      taxable,
      gstRate,
      supplierStateCode: branch.stateCode,
      placeOfSupplyCode: d.placeOfSupplyCode,
    });
    computedLines.push({
      input: line,
      ratePaise,
      taxable,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      amount: taxable + tax.cgst + tax.sgst + tax.igst,
      gstRate,
      lineNo: i + 1,
    });
  }

  const totals = computeDocumentTotals(
    computedLines.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode: branch.stateCode, placeOfSupplyCode: d.placeOfSupplyCode },
  );

  await withTransaction(async (tx: TxClient) => {
    await tx.quotationLine.deleteMany({ where: { quotationId: d.quotationId } });
    await tx.quotationLine.createMany({
      data: computedLines.map((l) => ({
        organizationId:    ctx.orgId,
        quotationId:       d.quotationId,
        lineNo:            l.lineNo,
        measurementItemId: l.input.measurementItemId ?? null,
        roomLabel:         (l.input.roomLabel ?? "").trim() || null,
        colourwayId:       l.input.colourwayId ?? null,
        serviceRateId:     l.input.serviceRateId ?? null,
        description:       l.input.description.trim(),
        quantity:          new Decimal(l.input.quantity),
        unit:              l.input.unit,
        rate:              l.ratePaise,
        discountPct:       new Decimal(l.input.discountPct ?? 0),
        taxable:           l.taxable,
        gstRate:           new Decimal(l.gstRate),
        cgst:              l.cgst,
        sgst:              l.sgst,
        igst:              l.igst,
        amount:            l.amount,
        isOptional:        l.input.isOptional ?? false,
      })),
    });
    await tx.quotation.update({
      where: { id: d.quotationId },
      data: {
        taxableAmount: totals.taxableAmount,
        cgst:          totals.cgst,
        sgst:          totals.sgst,
        igst:          totals.igst,
        roundOff:      totals.roundOff,
        total:         totals.total,
      },
    });
  }, { orgId: ctx.orgId });

  revalidatePath(`/quotations/${d.quotationId}`);
  return { ok: true, data: { id: d.quotationId } };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

// FIXES-01 §7.3 — one-shot "add this SKU to an existing draft quote"
// action for the PDP's Add-to-Quote modal. Recomputes the quote's
// totals in the same transaction as the line insert.
export async function appendColourwayToQuotation(
  input: unknown,
): Promise<ActionResult<{ quotationId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.update");

  const parsed = z.object({
    quotationId: z.string().min(1),
    colourwayId: z.string().min(1),
    quantity:    z.number().positive().max(999).optional(),
  }).safeParse(input);
  if (!parsed.success) return zodError<{ quotationId: string }>(parsed.error);
  const { quotationId, colourwayId, quantity = 1 } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id: quotationId },
    select: {
      id: true, status: true, branchId: true,
      lines: { select: { lineNo: true, taxable: true, gstRate: true } },
    },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (!["DRAFT", "REVISED"].includes(q.status)) {
    return { ok: false, error: `Only DRAFT quotations can be appended to (this one is ${q.status}).` };
  }

  const cw = await db.colourway.findUnique({
    where:  { id: colourwayId },
    select: {
      id: true, code: true, colourName: true, sellUnit: true,
      design: { select: { name: true, family: true, gstRate: true } },
      prices: {
        where:   { tier: "MRP" },
        orderBy: { effectiveFrom: "desc" },
        take:    1,
        select:  { amount: true },
      },
    },
  });
  if (!cw) return { ok: false, error: "Colourway not found" };

  const branch = await db.branch.findUniqueOrThrow({
    where:  { id: q.branchId },
    select: { stateCode: true },
  });

  const ratePaise = cw.prices[0]?.amount ?? 0n;
  const qtyFixed  = BigInt(Math.round(quantity * 10_000));
  const grossPaise = (ratePaise * qtyFixed) / 10_000n;
  const { taxable } = applyLineDiscount(grossPaise, 0);
  const gstRate = Number(cw.design.gstRate);
  const tax = computeLineTax({
    taxable,
    gstRate,
    supplierStateCode: branch.stateCode,
    placeOfSupplyCode: branch.stateCode,
  });
  const nextLineNo = (q.lines.reduce((m, l) => Math.max(m, l.lineNo), 0)) + 1;

  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.quotationLine.create({
        data: {
          organizationId: ctx.orgId,
          quotationId,
          lineNo:         nextLineNo,
          colourwayId,
          description:    `${cw.design.name} — ${cw.colourName}`,
          quantity:       new Decimal(quantity),
          unit:           cw.sellUnit,
          rate:           ratePaise,
          discountPct:    new Decimal(0),
          taxable,
          gstRate:        new Decimal(gstRate),
          cgst:           tax.cgst,
          sgst:           tax.sgst,
          igst:           tax.igst,
          amount:         taxable + tax.cgst + tax.sgst + tax.igst,
          isOptional:     false,
        },
      });
      // Rebuild document totals from every line (existing + new).
      const allLines = [
        ...q.lines.map((l) => ({ taxable: l.taxable, gstRate: Number(l.gstRate) })),
        { taxable, gstRate },
      ];
      const totals = computeDocumentTotals(allLines, {
        supplierStateCode: branch.stateCode,
        placeOfSupplyCode: branch.stateCode,
      });
      await tx.quotation.update({
        where: { id: quotationId },
        data:  {
          taxableAmount: totals.taxableAmount,
          cgst:          totals.cgst,
          sgst:          totals.sgst,
          igst:          totals.igst,
          roundOff:      totals.roundOff,
          total:         totals.total,
        },
      });
    }, { orgId: ctx.orgId });

    revalidatePath(`/quotations/${quotationId}`);
    return { ok: true, data: { quotationId } };
  } catch (e: unknown) {
    console.error("appendColourwayToQuotation failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not add to quote: ${e.message}` : "Could not add to quote",
    };
  }
}

// FIXES-01 §5.1 — owner sign-off to convert a lead-scoped quotation
// into a real Client + Project. Gate 2 of the two-approval flow (gate 1
// is `Quotation.status = ACCEPTED`, i.e. client acceptance recorded).
// Toggleable — passing `revoke: true` clears the approval if the owner
// changes their mind before conversion runs.
export async function approveQuotationForConversion(
  input: unknown,
): Promise<ActionResult<{ id: string; approved: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.convert");

  const parsed = z.object({
    id:     z.string().min(1),
    revoke: z.boolean().optional(),
  }).safeParse(input);
  if (!parsed.success) return zodError<{ id: string; approved: boolean }>(parsed.error);
  const { id, revoke } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id },
    select: { id: true, status: true, leadId: true, ownerConvertApprovedAt: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (!q.leadId) {
    return { ok: false, error: "Only lead-scoped quotations need conversion approval." };
  }
  if (!revoke && q.status !== "ACCEPTED") {
    return { ok: false, error: `Quote must be ACCEPTED before owner approval (currently ${q.status}).` };
  }

  await db.quotation.update({
    where: { id },
    data:  revoke
      ? { ownerConvertApprovedAt: null, ownerConvertApprovedById: null }
      : { ownerConvertApprovedAt: new Date(), ownerConvertApprovedById: ctx.userId },
  });

  revalidatePath(`/quotations/${id}`);
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { ok: true, data: { id, approved: !revoke } };
}
