// The items you can put on a purchase order, listed where you raise one.
//
// Owner, 2026-09-08: "you can also give me a sub section inside the
// purchase and vendors like listing the enter products with edit icon in
// them as we can add new items from there too for getting po".
//
// This is a third view onto the same catalogue the Product Catalog page
// shows — not a second product system. It reads through listProducts and
// edits through the existing product pages, so an item added here is the
// same item everywhere else in the app.

import Link from "next/link";
import type { Route } from "next";
import { Plus, Pencil } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listProducts } from "@/modules/products/queries";
import { formatINR } from "@/kernel/money/format";
import { can, requirePermission } from "@/kernel/rbac/guard";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; page?: string }

const TH =
  "px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim";

export default async function PurchaseItemsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  // listProducts guards this too; stating it here keeps the page's own
  // requirement visible rather than implied by what it happens to call.
  requirePermission(ctx, "catalog.view");
  const canSeePurchasing = can(ctx, "po.view");
  const q = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;

  const { rows, total, pageSize } = await listProducts(ctx, {
    ...(q != null && q !== "" && { search: q }),
    page,
    sort: "recent",
  });

  return (
    <>
      <Topbar
        title="Purchase & Vendors"
        eyebrow={`${total} item${total === 1 ? "" : "s"}${q ? ` · matching "${q}"` : ""}`}
        actions={
          <Link
            href={"/products/new" as Route}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12.5px] font-medium text-white transition-colors hover:opacity-90"
          >
            <Plus size={14} strokeWidth={2} />
            New item
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-[10px] border border-rule bg-surface-2 p-1">
          {canSeePurchasing && (
            <>
              <TabLink href="/purchase" label="Purchase Orders" active={false} />
              <TabLink href="/purchase/vendors" label="Vendors" active={false} />
            </>
          )}
          <TabLink href="/purchase/items" label="Items" active />
        </div>

        <form action="/purchase/items" method="GET" className="ml-auto">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search items…"
            className="h-[34px] w-[220px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text placeholder:text-text-faint transition-colors focus:border-accent focus:outline-none"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-rule bg-surface py-16 text-center">
          <div className="mb-1.5 text-[14px] font-medium text-text">
            {q ? "No items match that search." : "No items yet."}
          </div>
          <p className="text-[12px] text-text-dim">
            Items added here can be picked on a purchase order.{" "}
            <Link href={"/products/new" as Route} className="text-accent hover:underline">
              New item →
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-rule bg-surface">
          <table className="w-full border-collapse lg:min-w-[810px]">
            <thead>
              <tr className="border-b border-rule bg-surface-2">
                <th className={TH}>Item</th>
                <th className={`${TH} hidden md:table-cell`}>Brand</th>
                <th className={`${TH} hidden lg:table-cell`}>Category</th>
                <th className={`${TH} hidden sm:table-cell`}>Unit</th>
                <th className={`${TH} hidden lg:table-cell text-right`}>GST</th>
                <th className={`${TH} text-right`}>MRP</th>
                <th className={`${TH} w-[60px] text-right`}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.id}
                  className={[
                    "group transition-colors hover:bg-surface-2/60",
                    i > 0 ? "border-t border-rule" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-4">
                    <Link
                      href={`/products/${p.id}` as Route}
                      className="block text-[13px] font-semibold text-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-0.5 tabular text-[11px] text-text-faint">{p.code}</div>
                  </td>
                  <td className="hidden px-4 py-4 text-[12.5px] text-text-dim md:table-cell">
                    {p.brand}
                  </td>
                  <td className="hidden px-4 py-4 text-[12.5px] text-text-dim lg:table-cell">
                    {p.familyLabel}
                  </td>
                  <td className="hidden px-4 py-4 text-[12.5px] text-text-dim sm:table-cell">
                    {p.uom.toLowerCase().replace("_", " ")}
                  </td>
                  <td className="hidden px-4 py-4 text-right tabular text-[12.5px] text-text-dim lg:table-cell">
                    {p.gstRate}%
                  </td>
                  <td className="px-4 py-4 text-right tabular text-[12.5px] text-text">
                    {p.mrp == null ? "—" : formatINR(p.mrp)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/products/${p.id}/edit` as Route}
                      aria-label={`Edit ${p.name}`}
                      title={`Edit ${p.name}`}
                      className="inline-grid h-7 w-7 place-items-center rounded-[5px] text-text-faint transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      <Pencil size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="mt-4">
          <Pager total={total} page={page} pageSize={pageSize} />
        </div>
      )}
    </>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className={[
        "rounded-[7px] px-4 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "bg-surface text-text shadow-sm" : "text-text-dim hover:text-text",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
