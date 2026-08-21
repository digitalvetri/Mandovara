"use client";

// Item rows for the Stock tab. One row per Colourway (SKU) with:
//   swatch chip · brand · design + colour · family · qty · reorder · cost · GST · Edit
// Row click → EditStockModal (inline adjust qty + set reorder level).
// Empty state matches the reference — "no items yet" pointing to the
// catalog since SKUs are created there, not here.

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Pencil, PackageOpen } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { StockItemRow } from "@/modules/inventory/queries";
import { EditStockModal } from "./EditStockModal";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC:    "Curtains",
  SHEER:             "Sheer",
  WALLPAPER:         "Wallpaper",
  FLOORING:          "Flooring",
  CARPET_ROLL:       "Carpet",
  CARPET_TILE:       "Carpet tile",
  RUG:               "Rugs",
  BLIND:             "Blinds",
  UPHOLSTERY_FABRIC: "Upholstery",
  INTERIOR_FILM:     "Film",
  HARDWARE_TRACK:    "Track",
  HARDWARE_ROD:      "Rod",
  MOTOR:             "Motor",
  ACCESSORY:         "Accessory",
  SERVICE:           "Service",
};

interface Props { rows: StockItemRow[] }

export function StockList({ rows }: Props) {
  const [editing, setEditing] = useState<StockItemRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-rule bg-surface px-6 py-12 text-center">
        <PackageOpen size={26} className="mx-auto mb-3 text-text-faint" />
        <div className="mb-1 text-[14px] font-semibold text-text">No stock items yet</div>
        <div className="mx-auto max-w-[380px] text-[12.5px] text-text-dim">
          SKUs come from the Product Catalog. Add a design there, then adjust its stock quantity here after a GRN.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
        {/* Header row (desktop) */}
        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_84px_84px_84px_100px_100px_60px] items-center gap-3 border-b border-rule px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-dim">
          <span>Item</span>
          <span className="text-right">On hand</span>
          <span className="text-right">Reorder</span>
          <span>Family</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Incl. GST</span>
          <span />
        </div>

        <ul className="divide-y divide-rule">
          {rows.map((r) => <Row key={r.colourwayId} r={r} onEdit={() => setEditing(r)} />)}
        </ul>
      </div>

      {editing && (
        <EditStockModal
          item={editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function Row({ r, onEdit }: { r: StockItemRow; onEdit: () => void }) {
  const inclGst = grossFromCost(r.lastCostPaise, r.gstRate);
  return (
    <li className="md:grid md:grid-cols-[minmax(0,2fr)_84px_84px_84px_100px_100px_60px] flex flex-col gap-2 md:gap-3 items-start md:items-center px-5 py-3 hover:bg-surface-2/40">
      {/* Item */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-[6px] border border-rule"
          style={{ background: r.hex ?? "var(--color-surface-2, #1a2340)" }}
        />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/products/${r.colourwayId}` as Route}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[13.5px] font-semibold text-text hover:text-accent hover:-translate-y-0.5 transition-all duration-200"
            >
              {r.designName} — {r.colourName}
            </Link>
            {r.isOut ? (
              <span className="rounded-full bg-fault/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-fault">
                Out
              </span>
            ) : r.isLow ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-heat/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-heat">
                <AlertTriangle size={9} />
                Low
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-text-dim">
            <span className="tabular-nums">{r.code}</span>
            <span className="mx-1.5 text-text-subtle">·</span>
            <span>{r.brandName}</span>
          </div>
        </div>
      </div>

      {/* On hand */}
      <div className="text-right md:text-right">
        <div className={`tabular-nums text-[13.5px] font-medium ${r.isOut ? "text-fault" : r.isLow ? "text-heat" : "text-text"}`}>
          {formatQty(r.onHand)}
        </div>
        <div className="text-[10.5px] text-text-dim md:hidden">on hand · {unitLabel(r.sellUnit)}</div>
      </div>

      {/* Reorder */}
      <div className="text-right">
        <div className="tabular-nums text-[12.5px] text-text-dim">
          {r.reorderLevel == null ? "—" : formatQty(r.reorderLevel)}
        </div>
        <div className="text-[10.5px] text-text-dim md:hidden">reorder at</div>
      </div>

      {/* Family */}
      <div className="text-[11px] text-text-dim">
        {FAMILY_LABEL[r.family] ?? r.family}
      </div>

      {/* Cost */}
      <div className="tabular-nums text-right text-[12.5px] text-text-dim">
        {r.lastCostPaise > 0n ? formatINR(r.lastCostPaise) : "—"}
      </div>

      {/* Incl. GST */}
      <div className="tabular-nums text-right text-[12.5px] text-text">
        {r.lastCostPaise > 0n ? formatINR(inclGst) : "—"}
      </div>

      {/* Edit */}
      <div className="md:justify-self-end">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-[6px] border border-rule px-2 py-1 text-[11px] text-text-dim hover:border-gold hover:text-gold"
          aria-label={`Edit ${r.code}`}
        >
          <Pencil size={11} />
          Edit
        </button>
      </div>
    </li>
  );
}

function formatQty(q: string): string {
  const n = Number(q);
  if (!Number.isFinite(n)) return q;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function unitLabel(u: string): string {
  const map: Record<string, string> = {
    METRE: "m", ROLL: "rl", SQFT: "sqft", SQM: "sqm",
    PIECE: "pc", SET: "set", BOX: "bx", RUNNING_FT: "rft",
  };
  return map[u] ?? u.toLowerCase();
}

function grossFromCost(costPaise: bigint, gstRateStr: string): bigint {
  const rate = Number(gstRateStr) || 0;
  const multiplier = BigInt(Math.round((100 + rate) * 100));
  return (costPaise * multiplier) / 10000n;
}
