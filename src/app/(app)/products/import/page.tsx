// /products/import — bulk-load Design rows from an Excel workbook.
// Wires the pre-existing importDesigns server action to a UI so owners
// can seed the catalog without adding designs one by one.
//
// Prerequisites: brands + collections must already exist. The importer
// resolves brand_name + collection_name to IDs, and fails per-row if
// either can't be matched.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { ImportForm } from "./_components/ImportForm";

export const dynamic = "force-dynamic";

export default async function CatalogImportPage() {
  const ctx = await devContext();
  const canImport = can(ctx, "catalog.create");

  return (
    <>
      <Topbar
        title="Bulk import designs"
        eyebrow="Upload an Excel workbook to add many products at once. Brands + collections must already exist."
        actions={
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-text hover:bg-ink/20 transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={1.75} />
            Back to catalog
          </Link>
        }
      />

      {!canImport ? (
        <div className="rounded-[14px] border border-rule bg-surface p-8 text-center text-[13px] text-text-dim">
          You need the <code className="font-mono text-text">catalog.create</code> permission to import.
        </div>
      ) : (
        <div className="max-w-[820px] mx-auto space-y-6">
          <ExcelFormatHelp />
          <ImportForm />
        </div>
      )}
    </>
  );
}

function ExcelFormatHelp() {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <h3 className="text-[13px] font-display font-semibold text-text mb-2">
        Excel format
      </h3>
      <p className="text-[12px] text-text-dim mb-4 leading-relaxed">
        First row is a header. One product per row. Columns marked
        <span className="text-fault"> *</span> are required.
      </p>

      <div className="overflow-x-auto rounded-[8px] border border-rule">
        <table className="w-full text-[11.5px]">
          <thead className="bg-ink/20 text-text-dim uppercase tracking-[0.06em] text-[10.5px]">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Column</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/60 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
            <tr>
              <td className="font-mono text-text">brand_name<span className="text-fault">*</span></td>
              <td className="text-text-dim">text</td>
              <td className="text-text-dim">Exact match on an existing brand.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">collection_name<span className="text-fault">*</span></td>
              <td className="text-text-dim">text</td>
              <td className="text-text-dim">Must exist under the brand AND match the family below.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">design_code<span className="text-fault">*</span></td>
              <td className="text-text-dim">text ≤ 60</td>
              <td className="text-text-dim">Unique across the whole catalog. Duplicates are skipped.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">design_name<span className="text-fault">*</span></td>
              <td className="text-text-dim">text ≤ 120</td>
              <td className="text-text-dim">Human-readable name.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">family<span className="text-fault">*</span></td>
              <td className="text-text-dim">enum</td>
              <td className="text-text-dim">One of: CURTAIN_FABRIC, SHEER, LINING, BLIND, WALLPAPER, FLOORING, CARPET_ROLL, CARPET_TILE, UPHOLSTERY_FABRIC, FOAM_FILLING, VERTICAL_GARDEN, INTERIOR_FILM, MURAL, HARDWARE_TRACK, HARDWARE_ROD, MOTOR, ACCESSORY, SERVICE.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">hsn<span className="text-fault">*</span></td>
              <td className="text-text-dim">text 4–8</td>
              <td className="text-text-dim">HSN code.</td>
            </tr>
            <tr>
              <td className="font-mono text-text">gst_rate<span className="text-fault">*</span></td>
              <td className="text-text-dim">number 0–28</td>
              <td className="text-text-dim">GST percentage.</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-[10.5px] text-text-dim italic bg-ink/10">
                Optional columns (leave blank if not applicable): roll_width_mm, roll_length_m,
                fabric_width_mm, pattern_repeat_mm, pattern_match (FREE / STRAIGHT / OFFSET),
                railroadable (TRUE / FALSE), gsm, area_per_box_sqft, tile_size_mm.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-text-dim mt-4 leading-relaxed">
        This creates <strong>designs</strong> only. Colourways + prices still need to be added
        per design after import (that step is per-SKU and can't be auto-derived from a spec sheet).
      </p>
    </div>
  );
}
