// /products — PDF catalog management hub.
// Shows only brands that have at least one PDF uploaded.
// Owners/Store can add new brands via the modal.

import Link from "next/link";
import type { Route } from "next";
import { BookOpen, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { listBrandsWithPdf } from "@/modules/catalog/queries";
import { NewBrandModal } from "./_components/NewBrandModal";

export const dynamic = "force-dynamic";

export default async function ProductCatalogPage() {
  const ctx      = await devContext();
  const canWrite = can(ctx, "catalog.create");
  const brands   = await listBrandsWithPdf(ctx);

  const totalCollections = brands.reduce((s, b) => s + b.collections.length, 0);
  const withPdf          = brands.reduce((s, b) => s + b.collections.filter((c) => c.catalogPdfKey).length, 0);

  return (
    <>
      <Topbar
        title="Product Catalog"
        eyebrow={`${brands.length} brands · ${withPdf} of ${totalCollections} PDFs uploaded`}
        actions={canWrite ? <NewBrandModal /> : undefined}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Brands" value={brands.length} />
        <StatCard label="PDF Catalogs" value={withPdf} accent />
        <StatCard label="Missing PDFs" value={totalCollections - withPdf} fault={totalCollections - withPdf > 0} />
      </div>

      {brands.length === 0 ? (
        <EmptyBrands canWrite={canWrite} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {brands.map((b) => (
            <BrandCard key={b.id} brand={b} />
          ))}
        </div>
      )}
    </>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

type Brand = Awaited<ReturnType<typeof listBrandsWithPdf>>[number];

function BrandCard({ brand: b }: { brand: Brand }) {
  const total   = b.collections.length;
  const withPdf = b.collections.filter((c) => c.catalogPdfKey).length;
  const all     = total > 0 && withPdf === total;
  const coverPct = total === 0 ? 0 : Math.round((withPdf / total) * 100);

  return (
    <Link
      href={`/products/brand/${b.id}` as Route}
      className="group block rounded-[14px] bg-surface border border-rule shadow-sm hover:border-accent/40 hover:shadow-md transition-all duration-200"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-11 h-11 rounded-[10px] bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0">
            <span className="text-[16px] font-bold text-accent select-none">
              {b.name[0]?.toUpperCase()}
            </span>
          </div>
          {all && total > 0
            ? <CheckCircle2 size={16} className="text-solid mt-0.5 shrink-0" />
            : withPdf < total
              ? <AlertCircle size={16} className="text-heat/70 mt-0.5 shrink-0" />
              : null
          }
        </div>

        <div className="font-semibold text-[14.5px] text-text leading-tight mb-1 group-hover:text-accent transition-colors">
          {b.name}
        </div>
        {b.country && (
          <div className="text-[11px] text-text-dim mb-3">{b.country}</div>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-rule">
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} strokeWidth={1.75} className="text-text-dim" />
            <span className="text-[11.5px] text-text-dim">
              {total} collection{total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-text-dim tabular">
              {withPdf}/{total} PDFs
            </span>
            <ChevronRight size={12} strokeWidth={1.75} className="text-text-dim/50 group-hover:text-accent transition-colors" />
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3 h-1 rounded-full bg-rule overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${all ? "bg-solid" : withPdf > 0 ? "bg-heat" : "bg-rule"}`}
              style={{ width: `${coverPct}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

function StatCard({ label, value, accent, fault }: {
  label: string; value: number; accent?: boolean; fault?: boolean;
}) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-dim font-semibold mb-2">{label}</div>
      <div className={`text-[28px] font-data font-bold tabular leading-none ${
        accent ? "text-accent" : fault ? "text-fault" : "text-text"
      }`}>
        {value}
      </div>
    </div>
  );
}

function EmptyBrands({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <BookOpen size={40} strokeWidth={1.25} className="text-text-dim/40 mb-4" />
      <div className="text-[15px] font-medium text-text-dim mb-1">No catalog PDFs yet</div>
      <div className="text-[13px] text-text-dim/70 mb-5">
        {canWrite ? "Add a brand and upload its catalog PDFs to get started." : "No catalog PDFs have been uploaded yet."}
      </div>
      {canWrite && <NewBrandModal />}
    </div>
  );
}
