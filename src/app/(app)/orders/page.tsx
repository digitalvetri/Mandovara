import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listOrders } from "@/modules/orders/queries";
import { ORDER_STATUSES, type OrderStatus } from "@/modules/orders/schema";
import { OrderFilters } from "./_components/OrderFilters";
import { OrdersTable } from "./_components/OrdersTable";

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
  const ctx = await devContext();

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "total" | undefined) ?? "recent";

  const { rows, total, pageSize } = await listOrders(ctx, {
    ...(q != null && { search: q }),
    status, page, sort,
  });

  return (
    <>
      <Topbar
        title="Sales Orders & Dispatch"
        eyebrow={`${total} order${total === 1 ? "" : "s"} · ${eyebrowFor(status, q)}`}
        actions={
          <Link href={"/quotations" as Route}>
            <PrimaryButton>From Quotation</PrimaryButton>
          </Link>
        }
      />
      <OrderFilters />
      <OrdersTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

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
