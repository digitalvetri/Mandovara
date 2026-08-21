import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listOrders, getOrderSummaryCounts } from "@/modules/orders/queries";
import { ORDER_STATUSES, type OrderStatus } from "@/modules/orders/schema";
import { OrderFilters } from "./_components/OrderFilters";
import { OrdersTable } from "./_components/OrdersTable";
import { OrderSummaryCards } from "./_components/OrderSummaryCards";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  sort?: string;
}

export default async function OrdersPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx    = await devContext();
  const page   = parsePositiveInt(params.page) ?? 1;

  const q      = params.q?.trim();
  const status = normaliseStatus(params.status);
  const sort   = (params.sort as "recent" | "oldest" | "total" | undefined) ?? "recent";

  const [{ rows, total, pageSize }, counts] = await Promise.all([
    listOrders(ctx, { ...(q != null && { search: q }), status, page, sort }),
    getOrderSummaryCounts(ctx),
  ]);

  return (
    <>
      <Topbar
        title="Sales Orders"
        eyebrow={`${total} order${total === 1 ? "" : "s"} · ${eyebrowFor(status, q)}`}
        actions={<PrimaryButton href="/quotations">From Quotation</PrimaryButton>}
      />
      <OrderSummaryCards counts={counts} />
      <OrderFilters />
      <OrdersTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function normaliseStatus(v: string | undefined): OrderStatus | "OPEN" | "ALL" {
  if (v == null || v === "") return "OPEN";
  if (v === "OPEN" || v === "ALL") return v;
  if ((ORDER_STATUSES as readonly string[]).includes(v)) return v as OrderStatus;
  return "OPEN";
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function eyebrowFor(status: string, q: string | undefined): string {
  const bits: string[] = [];
  bits.push(status === "OPEN" ? "open" : status === "ALL" ? "all statuses" : status.toLowerCase());
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
