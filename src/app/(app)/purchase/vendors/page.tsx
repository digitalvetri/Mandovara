import Link from "next/link";
import type { Route } from "next";
import { Plus, Star } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listVendors } from "@/modules/vendors/queries";
import { getVendorPayables, type VendorPayableRow } from "@/modules/purchase/vendor-ledger";
import { formatINR } from "@/kernel/money/format";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; page?: string; }

export default async function VendorsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  const q = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  // Balances alongside the list so "who do I pay next" is answerable
  // without opening every vendor in turn (2026-08-27, owner instruction).
  const payables = await getVendorPayables(ctx);
  const payableBy = new Map(payables.rows.map((r) => [r.vendorId, r] as const));

  const { rows, total, pageSize } = await listVendors(ctx, {
    ...(q != null && { search: q }), page,
  });

  return (
    <>
      <Topbar
        title="Purchase & Vendors"
        eyebrow={`${total} vendor${total === 1 ? "" : "s"}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <Link
            href={"/purchase/vendors/new" as Route}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            New vendor
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-[10px] border border-rule bg-surface-2 p-1">
          <TabLink href="/purchase" label="Purchase Orders" active={false} />
          <TabLink href="/purchase/vendors" label="Vendors" active />
        </div>

        {/* Search */}
        <form action="/purchase/vendors" method="GET" className="ml-auto">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search vendors…"
            className="h-[34px] w-[220px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] bg-surface border border-rule py-16 text-center">
          <div className="text-[14px] font-medium text-text mb-1.5">No vendors yet.</div>
          <p className="text-[12px] text-text-dim">
            Add your first vendor to start issuing POs.{" "}
            <Link href={"/purchase/vendors/new" as Route} className="text-accent hover:underline">New vendor →</Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-rule bg-surface">
          <table className="min-w-[810px] w-full border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-rule">
                <th className="w-[5px] p-0" aria-hidden />
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Vendor</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">Mobile</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">GSTIN</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Terms</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Lead time</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">To pay</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => (
                <tr
                  key={v.id}
                  className={[
                    "group transition-colors hover:bg-surface-2/60",
                    i > 0 ? "border-t border-rule" : "",
                  ].join(" ")}
                >
                  {/* Accent strip keyed to lead time */}
                  <td className="p-0 w-[5px]">
                    <div className={`h-full w-[5px] min-h-[60px] ${leadStrip(v.leadTimeDays)}`} />
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/purchase/vendors/${v.id}` as Route}
                      className="block text-[13px] font-semibold text-accent hover:underline"
                    >
                      {v.name}
                    </Link>
                    <div className="text-[11px] text-text-faint mt-0.5 tabular">{v.code}</div>
                  </td>

                  <td className="px-4 py-4 tabular text-[12.5px] text-text-dim hidden md:table-cell">
                    {v.mobile}
                  </td>

                  <td className="px-4 py-4 tabular text-[12px] text-text-dim hidden lg:table-cell">
                    {v.gstin ?? <span className="text-text-faint">—</span>}
                  </td>

                  <td className="px-4 py-4 text-right tabular text-[12.5px] text-text-dim hidden sm:table-cell">
                    {v.paymentTermsDays}d
                  </td>

                  <td className="px-4 py-4">
                    <LeadTimeBadge days={v.leadTimeDays} />
                  </td>

                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <VendorPayable row={payableBy.get(v.id) ?? null} />
                  </td>

                  <td className="px-4 py-4 hidden sm:table-cell">
                    <RatingDots rating={v.rating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className={[
        "rounded-[7px] px-4 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "bg-surface shadow-sm text-text" : "text-text-dim hover:text-text",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function leadStrip(days: number): string {
  if (days <= 7)  return "bg-solid";
  if (days <= 14) return "bg-heat";
  return "bg-fault";
}

function LeadTimeBadge({ days }: { days: number }) {
  const [bg, text] = days <= 7
    ? ["bg-solid/12", "text-solid"]
    : days <= 14
      ? ["bg-heat/12", "text-heat"]
      : ["bg-fault/12", "text-fault"];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 tabular text-[11px] font-medium ${bg} ${text}`}>
      {days}d
    </span>
  );
}

function RatingDots({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-[12px] text-text-faint">—</span>;
  return (
    <div className="flex items-center gap-0.5" title={`Rating: ${rating}/5`}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star
          key={idx}
          size={11}
          className={idx < rating ? "text-gold" : "text-rule fill-none"}
          fill={idx < rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * What we owe this vendor, with ageing when they have been waiting.
 *
 * A vendor we owe nothing shows a dash rather than ₹0 — zero and
 * "nothing has ever been billed" look identical as a number, and the
 * dash reads correctly for both without claiming a settled account.
 */
function VendorPayable({ row }: { row: VendorPayableRow | null }) {
  if (!row || row.payable === 0n) {
    return <span className="text-[12px] text-text-faint">—</span>;
  }
  if (row.payable < 0n) {
    return (
      <span className="tabular text-[12.5px] text-good" title="We are in advance with this vendor">
        {formatINR(-row.payable)} adv
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span className="tabular text-[12.5px] font-medium text-warn">{formatINR(row.payable)}</span>
      {row.oldestDays !== null && row.oldestDays > 0 && (
        <span className="tabular text-[10.5px] text-text-faint">{row.oldestDays}d old</span>
      )}
    </span>
  );
}
