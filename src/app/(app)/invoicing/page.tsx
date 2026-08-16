// Invoicing landing page — redesigned to match the reference:
//   ┌ Invoices · N shown             + New Invoice
//   ├ 4 KPI tiles
//   ├ single search
//   └ one-line invoice rows
//
// Filter chips (status, sort) still live in URL params, driven by
// InvoiceFilters — kept as a thin secondary row so the header stays
// clean. The "+ New Invoice" button routes to /invoicing/new — a
// dedicated picker that lists open orders with a one-click "Create
// Invoice" per row (invoices are always minted from an Order in
// Mandovara's model, but the previous UX of dumping the user on the
// full /orders page was confusing).

import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { getInvoiceKpis, listInvoices } from "@/modules/invoices/queries";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/modules/invoices/schema";
import { InvoiceFilters } from "./_components/InvoiceFilters";
import { InvoiceKpiCards } from "./_components/InvoiceKpiCards";
import { InvoicesList } from "./_components/InvoicesList";
import { InvoiceSearchBar } from "./_components/InvoiceSearchBar";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  sort?: string;
}

export default async function InvoicingPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q      = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page   = parsePositiveInt(params.page) ?? 1;
  const sort   = (params.sort as "recent" | "oldest" | "total" | "duesoon" | undefined) ?? "recent";

  const [{ rows, total, pageSize }, kpis] = await Promise.all([
    listInvoices(ctx, {
      ...(q != null && { search: q }),
      status, page, sort,
    }),
    getInvoiceKpis(ctx),
  ]);

  return (
    <>
      <Topbar title="" eyebrow="" />

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-none text-text">Invoices</h1>
          <div className="mt-1 text-[11.5px] text-text-dim tabular-nums">
            {total} {total === 1 ? "shown" : "shown"}
          </div>
        </div>
        <Link
          href={"/invoicing/new" as Route}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-gold-strong"
        >
          <Plus size={13} strokeWidth={2.4} />
          New Invoice
        </Link>
      </div>

      {/* ── KPI tiles ───────────────────────────────────────── */}
      <InvoiceKpiCards kpis={kpis} />

      {/* ── Search + filter row ─────────────────────────────── */}
      <InvoiceSearchBar />
      <InvoiceFilters />

      {/* ── Rows ────────────────────────────────────────────── */}
      <InvoicesList rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseStatus(v: string | undefined): InvoiceStatus | "OUTSTANDING" | "ALL" {
  if (v == null || v === "") return "OUTSTANDING";
  if (v === "OUTSTANDING" || v === "ALL") return v;
  if ((INVOICE_STATUSES as readonly string[]).includes(v)) return v as InvoiceStatus;
  return "OUTSTANDING";
}
function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
