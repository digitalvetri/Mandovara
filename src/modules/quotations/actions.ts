"use server";

// Quotation server actions.
//
// Create is the interesting one:
//   - Runs inside withTransaction so numbering allocation + document write
//     participate in the same commit (Rule 6).
//   - Numbering: kernel/numbering.allocateNumber. Prefix from Branch.invoicePrefix.
//     docType "QUOTATION". FY derived from date.
//   - GST math: kernel/tax.computeLineTax + computeDocumentTotals. Nothing
//     from the client is trusted for taxable/CGST/SGST/IGST/amount.
//   - The scoped extension inside a raw transaction is not available (Prisma
//     limitation), so `orgId` and `branchId` filtering are applied explicitly
//     on the queries the tx uses. The final creates still write through
//     scoped(ctx) — see "post-tx write" for detail.

import type { z } from "zod";
import { revalidatePath } from "next/cache";

// revalidatePath throws "static generation store missing" when the action
// is invoked outside a Next request context (smoke scripts, integration
// tests). It's a cache-invalidation hint — swallowing it there keeps the
// same action callable from both surfaces without a parallel API.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { computeLineTax, applyLineDiscount, computeDocumentTotals } from "@/kernel/tax/gst";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import {
  createQuotationSchema, setStatusSchema, type QuotationLineInput,
} from "./schema";
import { enforceMeasurementGate } from "./measurement-gate";
import { buildCalcSnapshots, type FreezeCalc } from "./calc-snapshot";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createQuotation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.create");

  const parsed = createQuotationSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const d = parsed.data;

  const date = new Date(d.date);
  const validUntil = new Date(d.validUntil);
  if (validUntil <= date) {
    return { ok: false, error: "Validation failed", fieldErrors: { validUntil: "Valid until must be after the quotation date" } };
  }

  // Pre-tx lookups (branch + client + products) — scoped so tenant is enforced.
  const db = scoped(ctx);
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: d.branchId },
    select: { id: true, invoicePrefix: true, stateCode: true },
  });
  const client = await db.client.findUniqueOrThrow({
    where: { id: d.clientId },
    select: { id: true, stateCode: true },
  });

  const productIds = d.lines.map((l) => l.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, gstRate: true, name: true, requiresMeasurement: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // §0.10 gate — load referenced measurements once, then hand off to the
  // pure validator in ./measurement-gate for the actual rule checks.
  const measurementIds = d.lines
    .map((l) => l.measurementItemId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const measurementRows = measurementIds.length > 0
    ? await db.measurementItem.findMany({
        where:  { id: { in: measurementIds } },
        select: {
          id: true,
          project: { select: { clientId: true } },
        },
      })
    : [];
  const measurementMap = new Map(
    measurementRows.map((m) => [m.id, { id: m.id, clientId: m.project.clientId }]),
  );

  const gate = enforceMeasurementGate({
    clientId: client.id,
    lines:    d.lines,
    products: productMap,
    measurements: measurementMap,
  });
  if (!gate.ok) return gate;

  // Build lines with kernel math
  const linesForCompute: {
    input: QuotationLineInput; ratePaise: bigint; grossPaise: bigint;
    taxable: bigint; discount: bigint;
    cgst: bigint; sgst: bigint; igst: bigint; amount: bigint; gstRate: number;
    lineNo: number; description: string;
  }[] = [];

  for (let i = 0; i < d.lines.length; i++) {
    const line = d.lines[i]!;
    const product = productMap.get(line.productId);
    if (!product) {
      return { ok: false, error: "Validation failed",
               fieldErrors: { [`lines.${i}.productId`]: "Product not found" } };
    }
    const ratePaise = parseINR(line.rate);
    const qtyPaise = BigInt(Math.round(line.quantity * 10_000)); // 4dp
    const grossPaise = (ratePaise * qtyPaise) / 10_000n;
    const { discount, taxable } = applyLineDiscount(grossPaise, line.discountPct ?? 0);
    const gstRateNum = Number(product.gstRate);
    const tax = computeLineTax({
      taxable, gstRate: gstRateNum,
      supplierStateCode: branch.stateCode,
      placeOfSupplyCode: client.stateCode,
    });
    const amount = taxable + tax.cgst + tax.sgst + tax.igst;
    linesForCompute.push({
      input: line, ratePaise, grossPaise, taxable, discount,
      cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, amount,
      gstRate: gstRateNum, lineNo: i + 1,
      description: (line.description ?? "").trim() !== "" ? line.description!.trim() : product.name,
    });
  }

  const totals = computeDocumentTotals(
    linesForCompute.map((l) => ({ taxable: l.taxable, gstRate: l.gstRate })),
    { supplierStateCode: branch.stateCode, placeOfSupplyCode: client.stateCode },
  );

  // Allocate number + create quotation + lines inside one transaction.
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      branch.id,
      docType:       "QUOTATION",
      financialYear: financialYear(date),
      prefix:        `${branch.invoicePrefix}/QT`,
    });
    const q = await tx.quotation.create({
      data: {
        orgId:         ctx.orgId,
        branchId:      branch.id,
        number,
        revision:      0,
        clientId:      client.id,
        date, validUntil,
        status:        "DRAFT",
        taxableAmount: totals.taxableAmount,
        cgst:          totals.cgst,
        sgst:          totals.sgst,
        igst:          totals.igst,
        roundOff:      totals.roundOff,
        total:         totals.total,
        ownerId:       ctx.userId,
        createdById:   ctx.userId,
      },
      select: { id: true },
    });
    await tx.quotationLine.createMany({
      data: linesForCompute.map((l) => ({
        quotationId:       q.id,
        lineNo:            l.lineNo,
        productId:         l.input.productId,
        // §0.10 link — kept in sync with the gate result above so the
        // downstream freeze on SEND has a measurement to look up.
        measurementItemId: l.input.measurementItemId ?? null,
        description:       l.description,
        quantity:          new Prisma.Decimal(l.input.quantity),
        rate:              l.ratePaise,
        discountPct:       new Prisma.Decimal(l.input.discountPct ?? 0),
        taxable:           l.taxable,
        gstRate:           new Prisma.Decimal(l.gstRate),
        cgst:              l.cgst,
        sgst:              l.sgst,
        igst:              l.igst,
        amount:            l.amount,
        isOptional:        l.input.isOptional ?? false,
      })),
    });
    return q;
  });

  safeRevalidate("/quotations");
  return { ok: true, data: { id: created.id } };
}

// Thin server-action wrapper around listMeasurementsForClient. The
// quotation builder can't fetch this at page load — the client isn't
// picked yet — so it calls this after the client select changes.
export async function loadMeasurementsForClient(
  clientId: string,
): Promise<ActionResult<import("./queries").MeasurementPickerRow[]>> {
  const ctx = await devContext();
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { ok: false, error: "clientId required" };
  }
  const { listMeasurementsForClient } = await import("./queries");
  const rows = await listMeasurementsForClient(ctx, clientId);
  return { ok: true, data: rows };
}

export async function setQuotationStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  requirePermission(ctx, status === "SENT" ? "quotation.send" : "quotation.update");

  const db = scoped(ctx);

  // §15 non-negotiable #3: on DRAFT → SENT freeze every M2M line's
  // CalcResult onto QuotationLine.calcSnapshot so a later engine change
  // never re-prices a sent quote. Runs in one tx alongside the status
  // flip so we can never end up with SENT lines missing their snapshot.
  if (status === "SENT") {
    await withTransaction(async (tx: TxClient) => {
      const current = await tx.quotation.findUniqueOrThrow({
        where: { id },
        select: { status: true, orgId: true },
      });
      if (current.status === "SENT") return; // idempotent — no-op re-send

      const lines = await tx.quotationLine.findMany({
        where: { quotationId: id },
        select: { id: true, measurementItemId: true },
      });
      const measurementIds = lines
        .map((l) => l.measurementItemId)
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      const calcs = measurementIds.length > 0
        ? await tx.calcResult.findMany({
            where: { measurementItemId: { in: measurementIds } },
            select: {
              measurementItemId: true, engineVersion: true, family: true,
              inputs: true, outputs: true, warnings: true, computedAt: true,
            },
          })
        : [];
      const calcMap = new Map<string, FreezeCalc>(
        calcs.map((c) => [c.measurementItemId, {
          measurementItemId: c.measurementItemId,
          engineVersion:     c.engineVersion,
          family:            c.family,
          inputs:            c.inputs,
          outputs:           c.outputs,
          warnings:          c.warnings,
          computedAt:        c.computedAt,
        }]),
      );
      const instructions = buildCalcSnapshots({ lines, calcs: calcMap, now: new Date() });
      for (const inst of instructions) {
        await tx.quotationLine.update({
          where: { id: inst.lineId },
          data:  { calcSnapshot: inst.snapshot as unknown as Prisma.InputJsonValue },
        });
      }
      await tx.quotation.update({ where: { id }, data: { status } });
    });
  } else {
    await db.quotation.update({ where: { id }, data: { status } });
  }

  safeRevalidate("/quotations");
  safeRevalidate(`/quotations/${id}`);

  // §14 Phase 8 — fire-and-forget WhatsApp on SEND. Best-effort,
  // outside any tx, throw swallowed so a WhatsApp failure never
  // stops the client from receiving the PDF via other channels.
  if (status === "SENT") {
    try {
      const [{ sendWhatsAppMessage }, quote] = await Promise.all([
        import("@/modules/whatsapp/actions"),
        db.quotation.findUniqueOrThrow({
          where: { id },
          select: { number: true, client: { select: { primaryMobile: true } } },
        }),
      ]);
      await sendWhatsAppMessage({
        templateName:   "quotation_sent",
        language:       "en",
        toMobile:       quote.client.primaryMobile,
        params:         { "1": quote.number },
        idempotencyKey: `quotation:${id}:sent`,
        entityType:     "QUOTATION",
        entityId:       id,
      });
    } catch { /* best-effort */ }
  }

  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────

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

