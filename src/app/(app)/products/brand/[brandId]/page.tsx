import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { getBrandById } from "@/modules/catalog/queries";
import { scoped } from "@/kernel/db/scoped";
import { CollectionPdfRow } from "./_components/CollectionPdfRow";
import { NewCollectionForm } from "./_components/NewCollectionForm";
import { DeleteBrandButton } from "./_components/DeleteBrandButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ brandId: string }>;
}

export default async function BrandCatalogPage({ params }: Props) {
  const { brandId } = await params;
  const ctx       = await devContext();
  const canWrite  = can(ctx, "catalog.update");
  const canAdd    = can(ctx, "catalog.create");
  const canDelete = can(ctx, "catalog.delete");

  const brand = await getBrandById(ctx, brandId);

  const collections = await scoped(ctx).collection.findMany({
    where: { brandId, isActive: true },
    orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, family: true, seasonYear: true, catalogPdfKey: true,
      _count: { select: { designs: true } },
    },
  });

  const withPdf    = collections.filter((c) => c.catalogPdfKey).length;
  const totalCount = collections.length;
  // Brand is deletable when every collection is a bare placeholder — no
  // designs, no sample books — so a mistakenly-created brand with an empty
  // collection under it can still be swept away in one action.
  const brandDeletable = collections.every((c) => c._count.designs === 0);

  return (
    <>
      <Topbar
        title={brand.name}
        eyebrow={`${totalCount} collection${totalCount !== 1 ? "s" : ""} · ${withPdf} PDF${withPdf !== 1 ? "s" : ""} uploaded`}
      />

      <div className="mb-5">
        <Link
          href={"/products" as Route}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          All brands
        </Link>
      </div>

      {/* Brand header */}
      <div className="rounded-[14px] bg-surface border border-rule p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[10px] bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0">
            <span className="text-[17px] font-bold text-accent select-none">
              {brand.name[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-semibold text-text leading-tight">{brand.name}</h1>
            {brand.country && (
              <div className="text-[12.5px] text-text-dim mt-0.5">{brand.country}</div>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="text-[11px] text-text-dim">
                Lead time: <span className="font-medium text-text">{brand.leadTimeDays} days</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-solid/70" />
                <span className="text-[11px] text-text-dim">
                  {withPdf} of {totalCount} catalog PDFs uploaded
                </span>
              </div>
            </div>
          </div>
          {canDelete && brandDeletable && (
            <DeleteBrandButton
              brandId={brandId}
              brandName={brand.name}
              emptyCollectionCount={totalCount}
            />
          )}
        </div>
      </div>

      {/* Collections list */}
      <div className="rounded-[14px] bg-surface border border-rule shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule bg-ink/10">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim font-semibold">
            Collections
          </div>
          {canAdd && <NewCollectionForm brandId={brandId} />}
        </div>

        {collections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-text-dim mb-4">No collections yet.</p>
            {canAdd && (
              <div className="flex justify-center">
                <NewCollectionForm brandId={brandId} />
              </div>
            )}
          </div>
        ) : (
          <div>
            {collections.map((col) => (
              <CollectionPdfRow
                key={col.id}
                collection={col}
                brandName={brand.name}
                canWrite={canWrite}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
