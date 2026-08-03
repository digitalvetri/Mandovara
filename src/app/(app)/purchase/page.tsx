import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listPOs } from "@/modules/purchase/queries";
import { PO_STATUSES, type POStatus } from "@/modules/purchase/schema";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function PurchasePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const status = normaliseStatus(params.status);
  const page = parsePositiveInt(params.page) ?? 1;

  const { rows, total, pageSize } = await listPOs(ctx, {
    ...(q != null && { search: q }),
    status, page,
  });

  const { POTable } = await import("./_components/POTable");

  return (
    <>
      <Topbar
        title="Purchase & Vendors"
        eyebrow={`${total} PO${total === 1 ? "" : "s"} · ${eyebrowFor(status, q)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={"/purchase/vendors" as Route}
                  className="h-[38px] px-3 grid place-items-center rounded-[8px] bg-surface border border-rule text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
              Vendors
            </Link>
            <Link href={"/purchase/new" as Route}>
              <PrimaryButton>New PO</PrimaryButton>
            </Link>
          </div>
        }
      />
      <POTable rows={rows} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseStatus(v: string | undefined): POStatus | "OPEN" | "ALL" {
  if (v == null || v === "") return "OPEN";
  if (v === "OPEN" || v === "ALL") return v;
  if ((PO_STATUSES as readonly string[]).includes(v)) return v as POStatus;
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
