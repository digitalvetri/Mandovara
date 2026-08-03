import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listVendors } from "@/modules/vendors/queries";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; page?: string; }

export default async function VendorsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  const q = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  const { rows, total, pageSize } = await listVendors(ctx, {
    ...(q != null && { search: q }), page,
  });

  return (
    <>
      <Topbar
        title="Vendors"
        eyebrow={`${total} vendor${total === 1 ? "" : "s"}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={"/purchase" as Route}
                  className="h-[38px] px-3 grid place-items-center rounded-[8px] bg-surface border border-rule text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
              POs
            </Link>
            <Link href={"/purchase/vendors/new" as Route}>
              <PrimaryButton>New Vendor</PrimaryButton>
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
          <div className="text-[14px] text-text mb-2">No vendors yet.</div>
          <p className="text-[12px] text-text-dim">
            Add your first vendor to start issuing POs. →{" "}
            <Link href={"/purchase/vendors/new" as Route} className="text-accent hover:underline">New vendor</Link>
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <th className="px-4 h-[34px] text-left font-medium">Name</th>
                <th className="px-4 h-[34px] text-left font-medium">Mobile</th>
                <th className="px-4 h-[34px] text-left font-medium">GSTIN</th>
                <th className="px-4 h-[34px] text-left font-medium">State</th>
                <th className="px-4 h-[34px] text-right font-medium">Terms</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/purchase/vendors/${v.id}` as Route} className="text-text hover:text-accent">
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular">{v.mobile}</td>
                  <td className="px-4 py-2 tabular text-text-dim">{v.gstin ?? "—"}</td>
                  <td className="px-4 py-2 tabular text-text-dim">{v.stateCode}</td>
                  <td className="px-4 py-2 text-right tabular text-text-dim">{v.paymentTerms}d</td>
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

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
