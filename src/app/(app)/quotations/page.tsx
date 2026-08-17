import { Download } from "lucide-react";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listQuotations } from "@/modules/quotations/queries";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/modules/quotations/schema";
import { QuotationFilters } from "./_components/QuotationFilters";
import { QuotationsTable } from "./_components/QuotationsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

export default async function QuotationsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q         = params.q?.trim() || undefined;
  const status    = normaliseStatus(params.status);
  const page      = parsePositiveInt(params.page) ?? 1;
  const dateFrom  = params.dateFrom ? new Date(params.dateFrom) : undefined;
  const dateTo    = params.dateTo ? new Date(params.dateTo + "T23:59:59") : undefined;

  const { rows, total, pageSize } = await listQuotations(ctx, {
    ...(q ? { search: q } : {}),
    status,
    dateFrom,
    dateTo,
    page,
  });

  // Build export URL with current filters so it matches what's shown on screen
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status !== "ALL") exportParams.set("status", status);
  if (params.dateFrom) exportParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) exportParams.set("dateTo", params.dateTo);
  const exportHref = `/api/quotations/export${exportParams.size > 0 ? `?${exportParams}` : ""}`;

  return (
    <>
      <Topbar
        title="Quotations"
        eyebrow="Create, manage and track all customer quotations in one place."
        actions={
          <>
            <a
              href={exportHref}
              download
              className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                         border border-rule bg-surface text-[12.5px] text-text-dim
                         hover:text-text hover:border-accent/60 transition-colors whitespace-nowrap"
            >
              <Download size={14} strokeWidth={1.75} />
              Export
            </a>
            <PrimaryButton href="/quotations/new">New Quotation</PrimaryButton>
          </>
        }
      />

      <QuotationFilters />

      <QuotationsTable rows={rows} />

      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseStatus(v: string | undefined): QuotationStatus | "ALL" {
  if (v == null || v === "" || v === "ALL") return "ALL";
  if ((QUOTATION_STATUSES as readonly string[]).includes(v)) return v as QuotationStatus;
  return "ALL";
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
