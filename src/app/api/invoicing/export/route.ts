// CSV export of the invoice list.
//
// Exports what the operator is currently looking at — the same search,
// status and sort the page was showing — not just the visible page.
// Someone exporting "Overdue" for a chase list would otherwise get the
// first 25 rows and no warning that the rest were missing.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { listInvoices } from "@/modules/invoices/queries";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/modules/invoices/schema";

export const dynamic = "force-dynamic";

/** Excel treats a leading =, +, - or @ as a formula. Neutralise it. */
function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function rupees(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  return `${neg ? "-" : ""}${(abs / 100n).toString()}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function isStatus(v: string): v is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const ctx = await devContext();
  const url = new URL(req.url);

  const q      = url.searchParams.get("q")?.trim();
  const rawSt  = url.searchParams.get("status") ?? "";
  const status: InvoiceStatus | "OUTSTANDING" | "ALL" =
    rawSt === "OUTSTANDING" || rawSt === "ALL" ? rawSt
    : isStatus(rawSt) ? rawSt
    : "ALL";
  const sort = (url.searchParams.get("sort") as "recent" | "oldest" | "total" | "duesoon" | null) ?? "recent";

  // MAX_PAGE_SIZE caps a single call, so page through to the end rather
  // than silently truncating the file.
  const all = [];
  for (let page = 1; page <= 200; page++) {
    const { rows, total } = await listInvoices(ctx, {
      ...(q ? { search: q } : {}),
      status, sort, page, pageSize: 100,
    });
    all.push(...rows);
    if (all.length >= total || rows.length === 0) break;
  }

  const header = [
    "Invoice #", "Client", "Project/SO", "Invoice Date", "Due Date",
    "Status", "Amount", "Paid", "Outstanding",
  ];
  const lines = [
    header.map(csvCell).join(","),
    ...all.map((r) => [
      csvCell(r.number),
      csvCell(r.clientName),
      csvCell(r.projectName ?? r.orderNumber ?? ""),
      csvCell(new Date(r.date).toISOString().slice(0, 10)),
      csvCell(new Date(r.dueDate).toISOString().slice(0, 10)),
      csvCell(r.status),
      csvCell(rupees(r.total)),
      csvCell(rupees(r.paidTotal)),
      csvCell(rupees(r.outstanding)),
    ].join(",")),
  ];

  // BOM so Excel opens UTF-8 correctly on Windows.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${status.toLowerCase()}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
