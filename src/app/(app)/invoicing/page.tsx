import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listInvoices } from "@/modules/invoices/queries";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/modules/invoices/schema";
import { InvoiceFilters } from "./_components/InvoiceFilters";
import { InvoicesTable } from "./_components/InvoicesTable";

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

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "total" | "duesoon" | undefined) ?? "recent";

  const { rows, total, pageSize } = await listInvoices(ctx, {
    ...(q != null && { search: q }),
    status, page, sort,
  });

  return (
    <>
      <Topbar
        title="Invoicing & GST"
        eyebrow={`${total} invoice${total === 1 ? "" : "s"} · ${eyebrowFor(status, q)}`}
      />
      <InvoiceFilters />
      <InvoicesTable rows={rows} />
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
function eyebrowFor(status: string, q: string | undefined): string {
  const bits: string[] = [];
  bits.push(status === "OUTSTANDING" ? "outstanding"
          : status === "ALL"          ? "all statuses"
          : status === "PARTIALLY_PAID" ? "partially paid"
          : status.toLowerCase());
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
