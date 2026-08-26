"use server";

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
import "@/kernel/events/register";
import { findMeasurementGateViolation, zodError } from "./lib";
import { createQuotationSchema, type QuotationLineInput } from "./schema";

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
  // quote cannot carry a made-to-measure line, because there is no project to
  // hang a measurement round off — the user must convert the lead first.
  // Hardware, motors, accessories and service remain quotable against a lead.
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
  // Owner-facing invoice-first flow (2026-08-26) opts out of the gate
  // by passing bypassMeasurementGate:true — the owner enters quantity
  // directly from the wizard and accepts the "quote before measure"
  // risk §0.10 was written to prevent. Every other caller defaults to
  // the safety net.
  if (!d.bypassMeasurementGate) {
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

// Explicit re-exports: a "use server" file may only export async functions,
// so the wildcard barrels these were split behind are not allowed.
