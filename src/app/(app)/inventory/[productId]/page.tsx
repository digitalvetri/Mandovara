import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { listBalances, listLedgerForProduct } from "@/modules/inventory/queries";
import { getProduct } from "@/modules/products/queries";

export const dynamic = "force-dynamic";

export default async function ProductStockPage({
  params,
}: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const ctx = await devContext();
  const product = await getProduct(ctx, productId);
  if (!product) notFound();

  const [balances, ledger] = await Promise.all([
    listBalances(ctx, { search: product.code, pageSize: 100 }),
    listLedgerForProduct(ctx, productId),
  ]);
  const forThis = balances.rows.filter((r) => r.productId === productId);
  const totalOnHand = forThis.reduce((s, r) => s + parseFloat(r.quantity), 0);
  const totalReserved = forThis.reduce((s, r) => s + parseFloat(r.reserved), 0);

  return (
    <>
      <Topbar
        title={product.name}
        eyebrow={`${product.code} · HSN ${product.hsn} · ${product.gstRate}% GST · ${product.uom}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Balance across {forThis.length} warehouse{forThis.length === 1 ? "" : "s"}
            </div>
            {forThis.length === 0 ? (
              <div className="text-[12px] text-text-faint">No stock yet.</div>
            ) : (
              <ul className="divide-y divide-rule/60">
                {forThis.map((b) => (
                  <li key={b.warehouseId} className="py-2 flex items-baseline justify-between">
                    <span className="text-[12.5px] text-text">{b.warehouseName}</span>
                    <span className="tabular text-text">{b.quantity} <span className="text-text-faint">{b.uom}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <div className="px-4 py-2 border-b border-rule flex items-baseline justify-between">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Stock ledger ({ledger.length})
              </div>
              <Link href={"/inventory/adjust" as Route}
                    className="text-[11px] text-accent hover:underline">
                New adjustment →
              </Link>
            </div>
            {ledger.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-text-faint">
                No movements yet.
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    <Th>When</Th>
                    <Th>Warehouse</Th>
                    <Th>Ref</Th>
                    <Th align="right">In</Th>
                    <Th align="right">Out</Th>
                    <Th align="right">Rate</Th>
                    <Th align="right">Running</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r) => (
                    <tr key={r.id} className="border-b border-rule/70 last:border-0">
                      <Td className="text-text-dim tabular">{formatDate(r.occurredAt)}</Td>
                      <Td className="text-text-dim">{r.warehouseName}</Td>
                      <Td>
                        <span className="uppercase text-[10.5px] tracking-[0.06em] text-text-dim">{r.refType}</span>
                        <div className="tabular text-[10.5px] text-text-faint">{r.refId.slice(-8)}</div>
                      </Td>
                      <Td align="right">
                        {r.direction === "IN"
                          ? <span className="tabular text-good">+{r.quantity}</span>
                          : <span className="text-text-faint">—</span>}
                      </Td>
                      <Td align="right">
                        {r.direction === "OUT"
                          ? <span className="tabular text-bad">−{r.quantity}</span>
                          : <span className="text-text-faint">—</span>}
                      </Td>
                      <Td align="right"><span className="tabular text-text-dim">{formatINR(r.rate)}</span></Td>
                      <Td align="right"><span className="tabular text-text">{r.runningBalance}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Totals</div>
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-text-dim text-[11.5px]">On hand</dt>
                <dd className="font-display text-[22px] font-semibold text-text tabular-nums">{totalOnHand} <span className="text-[12px] text-text-faint">{product.uom}</span></dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-text-dim text-[11.5px]">Reserved</dt>
                <dd className={`tabular ${totalReserved > 0 ? "text-warn" : "text-text-faint"}`}>{totalReserved}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-text-dim text-[11.5px]">Available</dt>
                <dd className="tabular text-text">{totalOnHand - totalReserved}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Attributes</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Reorder level" v={product.reorderLevel ?? "—"} />
              <Row k="Min stock"     v={product.minStock ?? "—"} />
              <Row k="Track batch"   v={product.trackBatch  ? "Yes" : "No"} />
              <Row k="Track serial"  v={product.trackSerial ? "Yes" : "No"} />
              <Row k="Category"      v={product.categoryName} />
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}
