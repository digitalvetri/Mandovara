import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { getProduct } from "@/modules/products/queries";
import { listDesignDocuments } from "@/modules/products/design-documents";
import { DesignGallery } from "../_components/DesignGallery";
import { StatusPill } from "../_components/StatusPill";
import { CatalogueViewer } from "./_components/CatalogueViewer";
import { MiniSpec, PriceBlock, SizePriceTable, VariantStrip, shortUom } from "./_components/ProductDetailParts";
import { ProjectContextBanner } from "../_components/ProjectContextBanner";
import { AttachToItemButton } from "./_components/AttachToItemButton";
import { AddToQuoteModal } from "./_components/AddToQuoteModal";
import { listOpenQuotationsForAppend } from "@/modules/quotations/queries";
import { scoped } from "@/kernel/db/scoped";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ forProject?: string; itemId?: string }>;
}) {
  const { id } = await params;
  const sp      = await searchParams;
  const ctx     = await devContext();
  const product = await getProduct(ctx, id);
  if (!product) notFound();

  const uomShort      = shortUom(product.uom);
  const hasDiscount   = product.retail != null && product.mrp != null && product.retail < product.mrp;
  const canEdit       = can(ctx, "catalog.update");
  const hasSizePrices = product.prices.some((p) => p.tier.startsWith("SIZE:"));
  const canAppend     = can(ctx, "quotation.update");
  const openQuotations = canAppend ? await listOpenQuotationsForAppend(ctx) : [];

  const forProjectId = sp.forProject?.trim() || null;
  const itemId       = sp.itemId?.trim() || null;
  const forProject = forProjectId
    ? await scoped(ctx).project.findUnique({
        where:  { id: forProjectId },
        select: { id: true, name: true },
      })
    : null;
  const targetItem = itemId && forProject
    ? await scoped(ctx).measurementItem.findUnique({
        where:  { id: itemId },
        select: { id: true, label: true, measurement: { select: { projectId: true } } },
      })
    : null;
  const validItem = targetItem && targetItem.measurement.projectId === forProject?.id
    ? targetItem : null;

  const ctaHint = validItem
    ? `Attaches ${product.code} to this measurement item and returns you to the round.`
    : forProject
      ? `Note the code ${product.code} — pick it on this project's measurement round.`
      : product.catalogPdfKey
        ? "Browse every pattern in the supplier's book, then pick and quote."
        : "Picks a client, adds this SKU as a preliminary line.";

  const documents = await listDesignDocuments(ctx, product.designId);

  return (
    <>
      <div className="pt-4 pb-2">
        <Link
          href={(forProject
            ? `/products?forProject=${encodeURIComponent(forProject.id)}${validItem ? `&itemId=${encodeURIComponent(validItem.id)}` : ""}`
            : "/products") as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.14em] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back to Catalogue
        </Link>
      </div>

      {forProject && (
        <ProjectContextBanner
          projectId={forProject.id}
          projectName={forProject.name}
          itemLabel={validItem?.label ?? null}
        />
      )}

      <Topbar
        title={product.name}
        eyebrow={`${product.brand} › ${product.collection}`}
        actions={
          canEdit ? (
            <Link
              href={`/products/${product.id}/edit` as Route}
              className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] border border-rule bg-surface text-[12px] text-text hover:border-accent hover:text-accent transition-colors"
            >
              <Pencil size={12} strokeWidth={2} />
              Edit details
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 pb-10 items-start">

        {/* ── LEFT: identity header + spec strip + attributes + siblings ── */}
        <div className="space-y-4">

          {/* Colour chip · name · code · status badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {product.hex && (
              <span
                className="h-[18px] w-[18px] rounded-full border border-rule/60 flex-shrink-0"
                style={{ background: product.hex }}
                aria-hidden
              />
            )}
            {product.colourName && product.colourName !== "Standard" && (
              <span className="text-[14px] text-text font-medium">{product.colourName}</span>
            )}
            <code className="tabular text-[12px] text-text-faint">{product.code}</code>
            <StatusPill status={product.status} />
            {product.isNew && (
              <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-accent/12 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                New
              </span>
            )}
          </div>

          {/* Mini spec strip: family · HSN · GST */}
          <div className="grid grid-cols-3 gap-3 rounded-[10px] border border-rule bg-surface/60 px-4 py-3">
            <MiniSpec label="Family" value={product.familyLabel} />
            <MiniSpec label="HSN"    value={product.hsn} mono />
            <MiniSpec label="GST"    value={`${product.gstRate}%`} mono />
          </div>

          {/* Family attributes */}
          {product.attributes.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
                Specifications
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-8 text-[12.5px]">
                {product.attributes.map((a) => (
                  <div key={a.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-text-dim text-[11.5px]">{a.label}</dt>
                    <dd className="text-text text-right tabular">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Sibling colourways */}
          {product.siblingColourways.length > 0 && (
            <VariantStrip currentId={product.id} siblings={product.siblingColourways} />
          )}
        </div>

        {/* ── RIGHT: sticky pricing + CTA card ───────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule p-5 space-y-4 lg:sticky lg:top-6">

          {/* Price */}
          {hasSizePrices ? (
            <SizePriceTable prices={product.prices} uomShort={uomShort} />
          ) : (
            <PriceBlock
              retail={product.retail}
              mrp={product.mrp}
              cost={product.cost}
              uomShort={uomShort}
              hasDiscount={hasDiscount}
            />
          )}

          <div className="border-t border-rule" />

          {/* Dye lot only.
              The "In stock" badge is gone (2026-08-27, owner
              instruction: "I don't need to include the product catalog
              with the stock module"). The catalog exists to present what
              Mandovara can supply — including designs sourced to order,
              which a stock badge wrongly makes look unavailable.
              Warehouse figures live in Stocks, for the people who act on
              them. */}
          <div className="flex flex-wrap gap-2">
            {product.dyeLotHint && (
              <span
                className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-gold/15 text-[11px] uppercase tracking-[0.1em] text-accent"
                title={`Dye lot: ${product.dyeLotHint}`}
              >
                Dye lot {product.dyeLotHint}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="space-y-2">
            {validItem ? (
              <AttachToItemButton
                colourwayId={product.id}
                measurementItemId={validItem.id}
                itemLabel={validItem.label}
              />
            ) : forProject ? (
              <Link
                href={`/projects/${forProject.id}` as Route}
                className="group inline-flex items-center justify-center gap-2 w-full h-[44px] px-5 rounded-[10px] bg-gold text-ink font-display text-[14px] font-medium tracking-[-0.005em] hover:bg-gold-strong transition-colors"
              >
                Back to {forProject.name}
                <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : canAppend ? (
              <AddToQuoteModal
                colourwayId={product.id}
                colourwayCode={product.code}
                openQuotations={openQuotations}
                serializedTotals={openQuotations.map((q) => q.total.toString())}
              />
            ) : (
              <Link
                href={"/quotations/quick" as Route}
                className="group inline-flex items-center justify-center gap-2 w-full h-[44px] px-5 rounded-[10px] bg-gold text-ink font-display text-[14px] font-medium tracking-[-0.005em] hover:bg-gold-strong transition-colors"
              >
                Add to Quote
                <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            {product.catalogPdfKey && (
              <CatalogueViewer pdfKey={product.catalogPdfKey} designName={product.name} />
            )}
            <p className="text-[11px] text-text-faint text-center">{ctaHint}</p>
          </div>
        </div>

      </div>

      {/* Samples, room shots and brand PDFs — full width under the fold,
          because this is what a designer scrolls to with a client beside
          them (2026-08-27, owner instruction). */}
      <div className="mt-4 pb-10">
        <DesignGallery
          designId={product.designId}
          documents={documents}
          canEdit={can(ctx, "catalog.attachDocument")}
        />
      </div>
    </>
  );
}
