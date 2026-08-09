// Report export — returns an Excel workbook with 5 sheets (one per report section).
// Auth: uses devContext() same as the reports page itself.
// Money is converted from BigInt paise to ₹ decimal strings for readability.

import { devContext } from "@/lib/dev-context";
import { listArchitectReport } from "@/modules/reports/architect";
import { listConversionReport } from "@/modules/reports/conversion";
import { listDeadStockReport } from "@/modules/reports/deadstock";
import { listFamilyMarginReport } from "@/modules/reports/family";
import { listWastageReport } from "@/modules/reports/wastage";
import * as XLSX from "xlsx";

function inr(paise: bigint): string {
  return (Number(paise) / 100).toFixed(2);
}

export async function GET(): Promise<Response> {
  const ctx = await devContext();

  const [architects, familyMargin, conversion, deadStock, wastage] = await Promise.all([
    listArchitectReport(ctx),
    listFamilyMarginReport(ctx),
    listConversionReport(ctx),
    listDeadStockReport(ctx),
    listWastageReport(ctx),
  ]);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Architect Revenue & Commission ─────────────────────────────────
  const archWs = XLSX.utils.aoa_to_sheet([
    ["Firm", "Contact", "Mobile", "Projects", "Revenue (₹)", "Commission %",
     "Comm. Total (₹)", "Comm. Paid (₹)", "Comm. Pending (₹)"],
    ...architects.map((a) => [
      a.firmName,
      a.contactName,
      a.mobile,
      a.projectCount,
      inr(a.revenue),
      a.commissionPct,
      inr(a.commissionTotal),
      inr(a.commissionPaid),
      inr(a.commissionPending),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, archWs, "Architect Revenue");

  // ── Sheet 2: Family-wise Margin ─────────────────────────────────────────────
  const famWs = XLSX.utils.aoa_to_sheet([
    ["Product Family", "Revenue (₹)", "Material COGS (₹)", "Margin (₹)", "Margin %"],
    ...familyMargin.map((r) => [
      r.family.replace(/_/g, " "),
      inr(r.revenue),
      inr(r.cogs),
      inr(r.margin),
      r.marginPct ? `${r.marginPct}%` : "",
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, famWs, "Family Margin");

  // ── Sheet 3: Lead Conversion ────────────────────────────────────────────────
  const convWs = XLSX.utils.aoa_to_sheet([
    ["Source", "Total", "Won", "Lost", "In Progress", "Conversion %"],
    ...conversion.map((r) => [
      r.source.replace(/_/g, " "),
      r.total,
      r.won,
      r.lost,
      r.inProgress,
      r.conversionPct ? `${r.conversionPct}%` : "",
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, convWs, "Lead Conversion");

  // ── Sheet 4: Dead Stock by Dye Lot ──────────────────────────────────────────
  const dsWs = XLSX.utils.aoa_to_sheet([
    ["Brand", "Design", "Colour", "SKU", "Dye Lot", "Available", "Value (₹)", "Days Stale"],
    ...deadStock.map((r) => [
      r.brandName,
      r.designName,
      r.colourName,
      r.sku,
      r.dyeLot,
      r.available,
      inr(BigInt(r.valueStr)),
      r.lastMovedDays,
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, dsWs, "Dead Stock");

  // ── Sheet 5: Wastage by Tailor ──────────────────────────────────────────────
  const wastWs = XLSX.utils.aoa_to_sheet([
    ["Tailor / Assignee", "Jobs", "Fabric Issued (m)", "Fabric Wasted (m)", "Wastage %"],
    ...wastage.map((r) => [
      r.employeeName,
      r.jobCount,
      r.issuedM,
      r.wastedM,
      r.wastagePct ? `${r.wastagePct}%` : "",
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, wastWs, "Wastage by Tailor");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mandovara-reports-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
