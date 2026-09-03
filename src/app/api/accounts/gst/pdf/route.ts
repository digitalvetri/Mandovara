// GET /api/accounts/gst/pdf?year=2026&month=9
//
// One month of GST as a PDF — the Export button on the Accounts → GST
// tab (owner, 2026-09-04). Same shape as /api/reports/pdf: load the read
// model, format every BigInt to a rupee string here, hand plain strings
// to a react-pdf component, renderToBuffer.
//
// The permission is checked twice, and both are deliberate.
// loadGstSummary() opens with requirePermission(ctx, "expense.view") and
// is the rule — nothing reaches the data without it. But requirePermission
// THROWS, and a throw out of a route handler is a 500, so a role without
// the permission would be told the server broke rather than that they are
// not allowed. The explicit can() below turns that into an honest 403,
// the same way /api/reports/pdf does.

import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { scoped } from "@/kernel/db/scoped";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { loadGstSummary, formatPeriod, type GstPeriod } from "@/modules/accounts/gst";
import { LOGO_SRC } from "@/assets/logo-base64";
import { GstPdf, type GstPdfLine } from "@/app/(app)/accounts/_components/GstPdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await devContext();

  if (!can(ctx, "expense.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url   = new URL(req.url);
  const now   = new Date();
  const year  = clampInt(url.searchParams.get("year"),  2000, 2100, now.getFullYear());
  const month = clampInt(url.searchParams.get("month"),    1,   12, now.getMonth() + 1);
  const period: GstPeriod = { year, month };

  const summary = await loadGstSummary(ctx, period);

  // The studio's own GSTIN, for the header. Best-effort: a filing
  // summary is still useful to whoever asked for it if the org row has
  // not been filled in yet, so a missing one hides the line rather than
  // failing the export.
  let gstin: string | null = null;
  try {
    const org = await scoped(ctx).organization.findUnique({
      where:  { id: ctx.orgId },
      select: { gstin: true },
    });
    gstin = org?.gstin ?? null;
  } catch { /* header line is optional */ }

  const f = (n: bigint) => formatINR(n);

  const outputLines: GstPdfLine[] = summary.outputLines.map((l) => ({
    a: l.invoiceNumber.split("/").pop() ?? l.invoiceNumber,
    b: formatDate(l.date),
    c: l.clientName,
    taxable: f(l.taxable), cgst: f(l.cgst), sgst: f(l.sgst), igst: f(l.igst),
  }));

  const hsnLines: GstPdfLine[] = summary.hsnRows.map((r) => ({
    a: r.hsn,
    b: `${r.gstRate}%`,
    c: "",
    taxable: f(r.taxable), cgst: f(r.cgst), sgst: f(r.sgst), igst: f(r.igst),
  }));

  const inputLines: GstPdfLine[] = summary.inputLines.map((l) => ({
    a: formatDate(l.date),
    b: l.head,
    c: l.description,
    taxable: f(l.taxable), cgst: f(l.cgst), sgst: f(l.sgst), igst: f(l.igst),
  }));

  const element = React.createElement(GstPdf, {
    periodLabel: formatPeriod(period),
    generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    logoSrc:     LOGO_SRC,
    gstin,
    totals: {
      outputTaxable: f(summary.outputTaxable),
      outputCgst:    f(summary.outputCgst),
      outputSgst:    f(summary.outputSgst),
      outputIgst:    f(summary.outputIgst),
      totalOutput:   f(summary.totalOutput),
      inputTaxable:  f(summary.inputTaxable),
      inputCgst:     f(summary.inputCgst),
      inputSgst:     f(summary.inputSgst),
      inputIgst:     f(summary.inputIgst),
      totalInput:    f(summary.totalInput),
      netCgst:       f(summary.netCgst),
      netSgst:       f(summary.netSgst),
      netIgst:       f(summary.netIgst),
      netPayable:    f(summary.netPayable),
    },
    outputLines,
    hsnLines,
    inputLines,
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  // "GST-2026-09.pdf" — sorts chronologically in a folder, which is how
  // a year of filings actually gets stored.
  const name = `GST-${year}-${String(month).padStart(2, "0")}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control":       "no-store",
    },
  });
}

function clampInt(raw: string | null, lo: number, hi: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < lo || n > hi) return fallback;
  return n;
}
