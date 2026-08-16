// /products/[id]/edit — comprehensive edit form for a Colourway.
// Covers everything the New Product form captures plus the specs and
// per-size prices from the PDF (pile height, GSM, yarn, points, and
// 3x5/4x6/5x7/6x9/runner-set prices).

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getProductForEdit } from "@/modules/products/queries";
import { ProductEditForm } from "../../_components/ProductEditForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await devContext();
  const initial = await getProductForEdit(ctx, id);
  if (!initial) notFound();

  return (
    <>
      <div className="pt-4 pb-2">
        <Link
          href={`/products/${id}` as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.14em] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back to product
        </Link>
      </div>
      <Topbar
        title={`Edit — ${initial.name}`}
        eyebrow={`${initial.brand} · ${initial.familyLabel} · ${initial.code}`}
      />
      <ProductEditForm initial={initial} />
    </>
  );
}
