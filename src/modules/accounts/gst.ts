// GST filing summary — aggregates output tax (from invoices) and input credit
// (from Expense rows that have gstRatePct set) for a given calendar month.
// Both GSTR-1 (HSN-wise outward supply) and GSTR-3B (net payable) patterns live here.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface GstPeriod {
  year:  number;   // e.g. 2026
  month: number;   // 1–12
}

export interface OutputTaxLine {
  invoiceId:     string;
  invoiceNumber: string;
  date:          Date;
  clientName:    string;
  taxable:       bigint;
  cgst:          bigint;
  sgst:          bigint;
  igst:          bigint;
  total:         bigint;
}

export interface HsnRow {
  hsn:          string;
  gstRate:      number;
  taxable:      bigint;
  cgst:         bigint;
  sgst:         bigint;
  igst:         bigint;
}

export interface InputCreditLine {
  expenseId:   string;
  date:        Date;
  head:        string;
  description: string;
  gstRate:     number;
  taxable:     bigint;
  cgst:        bigint;
  sgst:        bigint;
  igst:        bigint;
  vendorGstin: string | null;
  billRef:     string | null;
}

export interface GstSummary {
  period:       GstPeriod;
  // output
  outputLines:  OutputTaxLine[];
  outputTaxable: bigint;
  outputCgst:   bigint;
  outputSgst:   bigint;
  outputIgst:   bigint;
  totalOutput:  bigint;
  // HSN rollup for GSTR-1
  hsnRows:      HsnRow[];
  // input credit
  inputLines:   InputCreditLine[];
  inputTaxable: bigint;
  inputCgst:    bigint;
  inputSgst:    bigint;
  inputIgst:    bigint;
  totalInput:   bigint;
  // net payable = totalOutput − totalInput (per component)
  netCgst:      bigint;
  netSgst:      bigint;
  netIgst:      bigint;
  netPayable:   bigint;
}

/** Load GST summary for a single calendar month. */
export async function loadGstSummary(
  ctx: RequestContext,
  period: GstPeriod,
): Promise<GstSummary> {
  requirePermission(ctx, "expense.view");
  const db = scoped(ctx);

  const from = new Date(period.year, period.month - 1, 1);
  const to   = new Date(period.year, period.month,     1); // exclusive

  // ── Output tax from invoices ──────────────────────────────────────────────
  const invoices = await db.invoice.findMany({
    where: {
      date:   { gte: from, lt: to },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: {
      id: true, number: true, date: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, total: true,
      clientId: true,
      lines: {
        select: {
          hsn: true, gstRate: true,
          taxable: true, cgst: true, sgst: true, igst: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Batch-load client names (Invoice has no Prisma @relation to Client)
  const clientIds = [...new Set(invoices.map((i) => i.clientId))];
  const clients   = clientIds.length > 0
    ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
    : [];
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const outputLines: OutputTaxLine[] = invoices.map((inv) => ({
    invoiceId:     inv.id,
    invoiceNumber: inv.number,
    date:          inv.date,
    clientName:    clientNameById.get(inv.clientId) ?? "—",
    taxable:       inv.taxableAmount,
    cgst:          inv.cgst,
    sgst:          inv.sgst,
    igst:          inv.igst,
    total:         inv.total,
  }));

  const outputTaxable = sumBigInt(outputLines.map((l) => l.taxable));
  const outputCgst    = sumBigInt(outputLines.map((l) => l.cgst));
  const outputSgst    = sumBigInt(outputLines.map((l) => l.sgst));
  const outputIgst    = sumBigInt(outputLines.map((l) => l.igst));
  const totalOutput   = outputCgst + outputSgst + outputIgst;

  // HSN rollup from invoice lines
  const hsnMap = new Map<string, HsnRow>();
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const key = `${line.hsn}|${line.gstRate}`;
      const existing = hsnMap.get(key);
      if (existing) {
        existing.taxable += line.taxable;
        existing.cgst    += line.cgst;
        existing.sgst    += line.sgst;
        existing.igst    += line.igst;
      } else {
        hsnMap.set(key, {
          hsn:     line.hsn,
          gstRate: Number(line.gstRate),
          taxable: line.taxable,
          cgst:    line.cgst,
          sgst:    line.sgst,
          igst:    line.igst,
        });
      }
    }
  }
  const hsnRows = [...hsnMap.values()].sort((a, b) => a.hsn.localeCompare(b.hsn));

  // ── Input credit from expenses ────────────────────────────────────────────
  const expenses = await db.expense.findMany({
    where: {
      incurredAt:  { gte: from, lt: to },
      gstRatePct:  { not: null },
    },
    select: {
      id: true, incurredAt: true, head: true, description: true,
      gstRatePct: true, taxable: true, cgst: true, sgst: true, igst: true,
      vendorGstin: true, billRef: true,
    },
    orderBy: { incurredAt: "asc" },
  });

  const inputLines: InputCreditLine[] = expenses
    .filter((e) => e.gstRatePct !== null && e.taxable !== null)
    .map((e) => ({
      expenseId:   e.id,
      date:        e.incurredAt,
      head:        e.head,
      description: e.description,
      gstRate:     Number(e.gstRatePct!),
      taxable:     e.taxable!,
      cgst:        e.cgst ?? 0n,
      sgst:        e.sgst ?? 0n,
      igst:        e.igst ?? 0n,
      vendorGstin: e.vendorGstin,
      billRef:     e.billRef,
    }));

  const inputTaxable = sumBigInt(inputLines.map((l) => l.taxable));
  const inputCgst    = sumBigInt(inputLines.map((l) => l.cgst));
  const inputSgst    = sumBigInt(inputLines.map((l) => l.sgst));
  const inputIgst    = sumBigInt(inputLines.map((l) => l.igst));
  const totalInput   = inputCgst + inputSgst + inputIgst;

  // Net payable — each component offset separately (as per GSTR-3B rules)
  const netCgst    = outputCgst > inputCgst ? outputCgst - inputCgst : 0n;
  const netSgst    = outputSgst > inputSgst ? outputSgst - inputSgst : 0n;
  const netIgst    = outputIgst > inputIgst ? outputIgst - inputIgst : 0n;
  const netPayable = netCgst + netSgst + netIgst;

  return {
    period,
    outputLines, outputTaxable, outputCgst, outputSgst, outputIgst, totalOutput,
    hsnRows,
    inputLines, inputTaxable, inputCgst, inputSgst, inputIgst, totalInput,
    netCgst, netSgst, netIgst, netPayable,
  };
}

/** Returns the last 12 month periods for the period picker (newest first). */
export function last12Months(): GstPeriod[] {
  const now   = new Date();
  const months: GstPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

export function formatPeriod(p: GstPeriod): string {
  return new Date(p.year, p.month - 1, 1)
    .toLocaleString("en-IN", { month: "long", year: "numeric" });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function sumBigInt(xs: bigint[]): bigint {
  return xs.reduce((a, b) => a + b, 0n);
}
