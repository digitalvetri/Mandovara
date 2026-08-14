import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { getProduct, listCategories } from "@/modules/products/queries";
import { ProductForm } from "../_components/ProductForm";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";

export const dynamic = "force-dynamic";

const TIER_ORDER = ["MRP", "COST", "DEALER", "DISTRIBUTOR", "PROJECT"] as const;

export default async function ProductDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();

  const [product, categories] = await Promise.all([
    getProduct(ctx, id),
    listCategories(ctx),
  ]);
  if (!product) notFound();

  const latestByTier = new Map<string, { amount: bigint; effectiveFrom: Date }>();
  for (const p of product.prices) {
    if (!latestByTier.has(p.tier)) latestByTier.set(p.tier, p);
  }

  return (
    <>
      <Topbar
        title={product.name}
        eyebrow={`${product.code} · ${product.categoryName} · HSN ${product.hsn} · ${product.gstRate}% GST`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[10px] border border-info/30 bg-info/8 px-4 py-3 text-[12px] text-text">
            Read-only view for now — this page still uses the legacy product
            schema. Edits do not persist yet. Prices, images, and HSN can be
            updated by re-running <span className="tabular text-text-dim">scripts/add-catalog.ts</span>.
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={product.status} />
            </div>
            <StatusChanger id={product.id} current={product.status} />
          </div>

          <ProductForm
            mode="edit"
            categories={categories}
            initial={{
              id: product.id,
              code: product.code,
              name: product.name,
              categoryName: product.categoryName,
              hsn: product.hsn,
              uom: product.uom,
              uomPrecision: product.uomPrecision,
              gstRate: product.gstRate,
              mrp:  product.mrp  != null ? String(Number(product.mrp)  / 100) : "",
              cost: product.cost != null ? String(Number(product.cost) / 100) : "",
              reorderLevel: product.reorderLevel ?? "",
              minStock:     product.minStock ?? "",
              trackBatch:   product.trackBatch,
              trackSerial:  product.trackSerial,
            }}
          />
        </div>

        <aside className="space-y-4 h-fit">
          {product.imageKey ? (
            <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
              <img src={product.imageKey} alt={product.name} className="w-full h-auto block" />
            </div>
          ) : (
            <div
              className="rounded-[14px] border border-rule flex items-center justify-center h-[220px] text-[10.5px] uppercase tracking-[0.14em] text-ink/60"
              style={{ background: product.hex ?? "var(--color-gold)" }}
            >
              No cover image yet
            </div>
          )}

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Current prices</div>
            <ul className="space-y-2 text-[12.5px]">
              {TIER_ORDER.filter((t) => latestByTier.has(t)).map((t) => {
                const p = latestByTier.get(t)!;
                return (
                  <li key={t} className="flex items-baseline justify-between">
                    <span className="text-text-dim uppercase text-[10.5px] tracking-[0.14em]">{t}</span>
                    <span className="text-text tabular">{formatINR(p.amount)}</span>
                  </li>
                );
              })}
              {latestByTier.size === 0 && (
                <li className="text-text-faint">No prices set.</li>
              )}
            </ul>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Attributes</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="UOM" v={`${product.uom} · ${product.uomPrecision} dp`} />
              <Row k="GST rate" v={`${product.gstRate}%`} />
              <Row k="HSN" v={product.hsn} mono />
              <Row k="Reorder level" v={product.reorderLevel ?? "—"} mono />
              <Row k="Min stock"     v={product.minStock     ?? "—"} mono />
              <Row k="Batch tracked"  v={product.trackBatch  ? "Yes" : "No"} />
              <Row k="Serial tracked" v={product.trackSerial ? "Yes" : "No"} />
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
