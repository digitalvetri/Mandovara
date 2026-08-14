"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo } from "react";
import { formatINR } from "@/kernel/money/format";
import type { ProductRow } from "@/modules/products/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

export function ProductsTable({
  rows, canSeeCost,
}: { rows: ProductRow[]; canSeeCost: boolean }) {
  // Cost column is conditional on RBAC (CLAUDE.md §3.1 — cost/margin stripped
  // server-side for unauthorised roles). Build the column list per-render so
  // the retrofit stays purely declarative.
  const columns = useMemo<readonly Column<ProductRow>[]>(() => {
    const base: Column<ProductRow>[] = [
      {
        key: "thumb", header: "", width: "72px",
        render: (r) => <Thumb src={r.imageKey} hex={r.hex} alt={r.name} />,
      },
      {
        key: "code", header: "Code",
        render: (r) => <span className="text-text tabular">{r.code}</span>,
      },
      { key: "name",     header: "Name",     render: (r) => r.name },
      { key: "category", header: "Category", cellClassName: "text-text-dim", render: (r) => r.categoryName },
      { key: "hsn",      header: "HSN",      render: (r) => <span className="tabular text-text-dim">{r.hsn}</span> },
      { key: "gst",      header: "GST %",    align: "right", render: (r) => <span className="tabular text-text-dim">{r.gstRate.toFixed(0)}%</span> },
      { key: "mrp",      header: "MRP",      align: "right", render: (r) => <span className="tabular text-text">{r.mrp ? formatINR(r.mrp) : "—"}</span> },
    ];
    if (canSeeCost) {
      base.push({
        key: "cost", header: "Cost", align: "right",
        render: (r) => <span className="tabular text-text-dim">{r.cost ? formatINR(r.cost) : "—"}</span>,
      });
    }
    base.push(
      { key: "uom",    header: "UOM",    cellClassName: "text-text-dim", render: (r) => r.uom },
      { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    );
    return base;
  }, [canSeeCost]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/products/${r.id}`}
      swatch={(r) => r.hex ?? undefined}
      ariaLabel="Products"
      emptyState={
        <EmptyState
          title="No products yet."
          body={
            <>
              Add SKUs manually or via Excel import (Session 4). →{" "}
              <Link href={"/products/new" as Route} className="text-accent hover:underline">
                New product
              </Link>
            </>
          }
        />
      }
    />
  );
}

// 40px catalog thumbnail — image when the colourway has one, otherwise a
// hex-tinted tile (falls back to the neutral surface if hex is null too).
// Design system §6.1: "swatch chip carrying the actual colourway hex or
// swatch image, on the left edge of every catalog row."
function Thumb({ src, hex, alt }: { src: string | null; hex: string | null; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block h-14 w-14 rounded-[6px] object-contain border border-rule bg-ink"
      />
    );
  }
  return (
    <span
      className="block h-14 w-14 rounded-[6px] border border-rule"
      style={{ background: hex ?? "var(--color-surface-hover)" }}
      aria-label={alt}
    />
  );
}
