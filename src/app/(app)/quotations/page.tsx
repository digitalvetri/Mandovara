import Link from "next/link";
import type { Route } from "next";
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
  page?: string;
  sort?: string;
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

  const { rows, total, pageSize } = await listQuotations(ctx, {
    ...(q != null && { search: q }),
    status, page, sort,
  });

  return (
    <>
      <Topbar
        title="Quotations"
        eyebrow={`${total} quote${total === 1 ? "" : "s"} · ${status === "ALL" ? "all statuses" : status.toLowerCase()}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <Link href={"/quotations/new" as Route}>
            <PrimaryButton>New Quotation</PrimaryButton>
          </Link>
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
