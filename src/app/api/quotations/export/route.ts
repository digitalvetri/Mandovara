// Quotation list export — returns an xlsx workbook with one sheet.
// Applies the same filters as the quotations list page (search, status, date range).
// Auth: devContext() — same as the list page.

import { devContext } from "@/lib/dev-context";
import { listQuotations } from "@/modules/quotations/queries";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/modules/quotations/schema";
import * as XLSX from "xlsx";

function inr(paise: bigint): string {
  return (Number(paise) / 100).toFixed(2);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<Response> {
  const ctx = await devContext();
  const url = new URL(req.url);

  const q = url.searchParams.get("q") || undefined;
  const statusParam = url.searchParams.get("status") || undefined;
  const dateFromParam = url.searchParams.get("dateFrom") || undefined;
  const dateToParam = url.searchParams.get("dateTo") || undefined;

  const status: QuotationStatus | "ALL" =
    statusParam && (QUOTATION_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as QuotationStatus)
      : "ALL";

  const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
  const dateTo = dateToParam ? new Date(dateToParam + "T23:59:59") : undefined;

  const { rows } = await listQuotations(ctx, {
    search: q,
    status,
    dateFrom,
    dateTo,
    pageSize: 5000,
    page: 1,
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "Quotation Number", "Client Name", "Client Mobile",
      "Project / Design", "Status",
      "Total Value (₹)", "Valid Upto", "Created On",
    ],
    ...rows.map((r) => [
      r.number,
      r.clientName,
      r.clientMobile,
      r.projectName,
      r.status,
      inr(r.total),
      isoDate(r.validUntil),
      isoDate(r.date),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Quotations");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotations-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
