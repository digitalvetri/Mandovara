// Stock → Sold out.
//
// The counter-sale half of inventory: record what left the shelf against
// a customer, and read back what has. Everything a sale writes is a
// StockMove of type SOLD_OUT, so this page and the Stock tab are two
// views of the same ledger — a sale recorded here shows as a lower
// available quantity there on the next render, with nothing to sync.
//
//   ┌ header
//   ├ tab row (Stock · Purchasing · Sold out · Pending)
//   ├ three totals for what is listed below
//   ├ "Record a sale" form   (inventory.adjust only)
//   └ recent sales, newest first

import { notFound } from "next/navigation";
import { PackageMinus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { countPendingStock } from "@/modules/pending-stock/queries";
import {
  listSellableStock, listSoldOut, summariseSoldOut,
} from "@/modules/inventory/queries-sold";
import { InventoryTabs } from "../_components/InventoryTabs";
import { SellStockForm } from "./_components/SellStockForm";

export const dynamic = "force-dynamic";

export default async function SoldOutPage() {
  const ctx = await devContext();

  // Everything below reads stock. Without inventory.view there is
  // nothing to show and nothing to sell, so this is a 404 rather than a
  // page of empty states.
  if (!ctx.permissions.has("inventory.view")) notFound();

  const canSell = ctx.permissions.has("inventory.adjust");

  const [items, rows, pendingCount] = await Promise.all([
    // The picker is only rendered for someone who can sell — don't pay
    // for the reservation sweep otherwise.
    canSell ? listSellableStock(ctx) : Promise.resolve([]),
    listSoldOut(ctx),
    countPendingStock(ctx),
  ]);
  const totals = summariseSoldOut(rows);

  return (
    <>
      <Topbar title="" />

      <div className="mb-4">
        <h1 className="font-display text-[28px] font-semibold leading-none text-text">Sold out</h1>
        <div className="mt-1 text-[12px] text-text-dim">
          Stock sold over the counter, and what it took off the shelf
        </div>
      </div>

      <InventoryTabs active="sold" pendingCount={pendingCount} />

      {/* Totals for exactly what is listed below — no period picker, so
          no chance of the headline and the list describing different
          windows. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Sales recorded" value={String(totals.saleCount)} />
        <Tile label="Units sold" value={totals.unitsSold} />
        <Tile label="Sale value" value={formatINR(totals.valuePaise)} />
      </div>

      {canSell && <SellStockForm items={items} />}

      <section className="overflow-hidden rounded-[14px] border border-rule bg-surface">
        <div className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-3">
          <div className="text-[13px] font-medium text-text">Recent sales</div>
          <div className="text-[11px] tabular-nums text-text-dim">
            {rows.length} {rows.length === 1 ? "sale" : "sales"}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <PackageMinus size={26} className="mx-auto mb-3 text-text-faint" />
            <div className="mb-1 text-[14px] font-semibold text-text">No sales recorded yet</div>
            <div className="mx-auto max-w-[400px] text-[12.5px] text-text-dim">
              {canSell
                ? "Use the form above the moment something goes out over the counter — the stock list drops by the same amount."
                : "Sales recorded by the store team will appear here."}
            </div>
          </div>
        ) : (
          <>
            {/* Header row, desktop only — the phone layout stacks each
                sale into its own block instead. */}
            <div className="hidden grid-cols-[minmax(0,2fr)_90px_100px_110px_minmax(0,1fr)] items-center gap-3 border-b border-rule px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-dim md:grid">
              <span>Item</span>
              <span className="text-right">Sold</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Value</span>
              <span>Sold to · date</span>
            </div>

            <ul className="divide-y divide-rule">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-1 gap-1.5 px-5 py-3.5 md:grid-cols-[minmax(0,2fr)_90px_100px_110px_minmax(0,1fr)] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-text">{r.label}</div>
                    <div className="mt-0.5 truncate text-[10.5px] tabular-nums text-text-dim">
                      {r.code}{r.dyeLot ? ` · lot ${r.dyeLot}` : ""}
                    </div>
                  </div>

                  {/* On a phone the three figures sit on one line with
                      their own labels; on desktop they are columns. */}
                  <div className="flex items-baseline gap-4 text-[12px] tabular-nums md:contents">
                    <span className="text-text md:text-right">
                      <span className="mr-1 text-[10px] uppercase text-text-subtle md:hidden">Sold</span>
                      {r.quantity}
                      <span className="ml-1 text-[10px] uppercase text-text-subtle">{r.sellUnit}</span>
                    </span>
                    <span className="text-text-dim md:text-right">
                      <span className="mr-1 text-[10px] uppercase text-text-subtle md:hidden">Rate</span>
                      {r.ratePaise > 0n ? formatINR(r.ratePaise) : "—"}
                    </span>
                    <span className="font-medium text-text md:text-right">
                      <span className="mr-1 text-[10px] uppercase text-text-subtle md:hidden">Value</span>
                      {r.totalPaise > 0n ? formatINR(r.totalPaise) : "—"}
                    </span>
                  </div>

                  <div className="min-w-0 text-[11.5px] text-text-dim">
                    <span className="truncate">{r.soldTo ?? "Counter sale"}</span>
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="tabular-nums">{formatDate(r.occurredAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-rule bg-surface p-4">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</div>
      <div className="text-[20px] font-semibold leading-none tabular-nums text-text">{value}</div>
    </div>
  );
}
