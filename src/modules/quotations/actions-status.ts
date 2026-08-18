"use server";

// Quotation status transitions: send, accept, reject.

import { z } from "zod";
import type { ProductFamily } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { devContext } from "@/lib/dev-context";
import "@/kernel/events/register";
import { findMeasurementGateViolation, zodError } from "./lib";
import { quotationLineInput, type QuotationLineInput } from "./schema";
import type { ActionResult } from "./actions";

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
