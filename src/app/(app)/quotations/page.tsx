import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listQuotations, quotationKPIs } from "@/modules/quotations/queries";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/modules/quotations/schema";
import { QuotationFilters } from "./_components/QuotationFilters";
import { QuotationsTable } from "./_components/QuotationsTable";
import { QuotationKPICards } from "./_components/QuotationKPICards";
import { QuotationCardView } from "./_components/QuotationCardView";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  sort?: string;
  view?: string;
}

export default async function QuotationsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "total" | undefined) ?? "recent";
  const view = params.view === "cards" ? "cards" : "list";

  const [{ rows, total, pageSize }, kpis] = await Promise.all([
    listQuotations(ctx, { ...(q != null && { search: q }), status, page, sort }),
    quotationKPIs(ctx),
  ]);

  return (
    <>
      <Topbar
        title="Quotations"
        eyebrow={`${kpis.total} total · Create, manage and track customer quotations`}
        actions={
          <Link href={"/quotations/new" as Route}>
            <PrimaryButton>New Quotation</PrimaryButton>
          </Link>
        }
      />
      <QuotationKPICards kpis={kpis} />
      <QuotationFilters statusCounts={kpis.byStatus} />
      {view === "cards" ? (
        <QuotationCardView rows={rows} />
      ) : (
        <QuotationsTable rows={rows} />
      )}
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
