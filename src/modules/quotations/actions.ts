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
import { MADE_TO_MEASURE_FAMILIES } from "./lib";
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
  const project = await db.project.findUniqueOrThrow({
    where: { id: d.projectId },
    select: { id: true, clientId: true },
  });
  const clientId = d.clientId ?? project.clientId;

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

  // § 0.10 / § 15.1 — server-side measurement gate, never UI-only
  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    if (line.measurementItemId) continue;

    if (line.colourwayId) {
      const cw = cwMap.get(line.colourwayId);
      if (!cw) {
        return {
          ok: false,
          error: "Validation failed",
          fieldErrors: { [`lines.${i}.colourwayId`]: "Colourway not found" },
        };
      }
      const family = cw.design.family as ProductFamily;
      if (MADE_TO_MEASURE_FAMILIES.has(family)) {
        return {
          ok: false,
          errorCode: "MEASUREMENT_REQUIRED",
          error: "Validation failed",
          fieldErrors: {
            [`lines.${i}.measurementItemId`]:
              `${family} is made-to-measure — a measurement item must be linked before quoting`,
          },
        };
      }
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
        projectId:      d.projectId,
        clientId:       clientId,
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
  });

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
  // (see onQuotationAccepted).
  if (status === "ACCEPTED") {
    await bus.publish({
      type:        "quotation.accepted",
      orgId:       ctx.orgId,
      actorId:     ctx.userId,
      occurredAt:  new Date(),
      quotationId: id,
      clientId:    q.clientId,
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

  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    if (line.measurementItemId) continue;
    if (line.colourwayId) {
      const cw = cwMap.get(line.colourwayId);
      if (!cw) continue;
      const family = cw.design.family as ProductFamily;
      if (MADE_TO_MEASURE_FAMILIES.has(family)) {
        return {
          ok: false,
          errorCode: "MEASUREMENT_REQUIRED",
          error: "Validation failed",
          fieldErrors: {
            [`lines.${i}.measurementItemId`]:
              `${family} is made-to-measure — a measurement item must be linked before quoting`,
          },
        };
      }
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
  });

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
