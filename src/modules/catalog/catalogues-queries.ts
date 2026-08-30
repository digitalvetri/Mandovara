// Queries for the /catalogues listing page — a flat, name-only view of
// every Collection organized by ProductFamily. Distinct from
// listBrandsWithPdf(), which groups by brand for the PDF-management view.

import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";
import type { ProductFamily } from "@prisma/client";

export interface CatalogueRow {
  id:      string;
  name:    string;
  family:  ProductFamily;
}

export interface FamilyGroup {
  family: ProductFamily;
  label:  string;
  rows:   CatalogueRow[];
}

// Display labels for ProductFamily enum values. Keep in sync with
// FAMILY_LABELS in CollectionPdfRow.tsx (both are UI-only).
export const FAMILY_LABEL: Record<ProductFamily, string> = {
  WALLPAPER:         "Wallpaper",
  CURTAIN_FABRIC:    "Curtain — main",
  SHEER:             "Curtain — sheer",
  LINING:            "Curtain — lining",
  BLIND:             "Blinds",
  FLOORING:          "Wooden flooring",
  CARPET_ROLL:       "Carpets",
  CARPET_TILE:       "Carpet tiles",
  RUG:               "Rugs",
  UPHOLSTERY_FABRIC: "Fabric",
  FOAM_FILLING:      "Foam",
  VERTICAL_GARDEN:   "Vertical garden",
  INTERIOR_FILM:     "Interior film",
  MURAL:             "Mural / customised",
  HARDWARE_TRACK:    "Curtain tracks",
  HARDWARE_ROD:      "Curtain rods",
  MOTOR:             "Motors",
  ACCESSORY:         "Accessories",
  SERVICE:           "Services",
};

// Order families for display — most-common categories first.
const FAMILY_ORDER: readonly ProductFamily[] = [
  "WALLPAPER", "MURAL",
  "CURTAIN_FABRIC", "SHEER", "LINING",
  "BLIND",
  "FLOORING",
  "CARPET_ROLL", "CARPET_TILE", "RUG",
  "UPHOLSTERY_FABRIC",
  "HARDWARE_TRACK", "HARDWARE_ROD", "MOTOR",
  "FOAM_FILLING", "VERTICAL_GARDEN", "INTERIOR_FILM",
  "ACCESSORY", "SERVICE",
];

export async function listCataloguesByFamily(
  ctx: RequestContext,
): Promise<FamilyGroup[]> {
  const db = scoped(ctx);
  const rows = await db.collection.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, family: true },
  });

  const byFamily = new Map<ProductFamily, CatalogueRow[]>();
  for (const r of rows) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }

  const groups: FamilyGroup[] = [];
  for (const family of FAMILY_ORDER) {
    const list = byFamily.get(family);
    if (list && list.length > 0) {
      groups.push({ family, label: FAMILY_LABEL[family], rows: list });
    }
  }
  // Any families we didn't order explicitly get appended (shouldn't happen
  // — the enum is closed — but keeps behaviour deterministic).
  for (const [family, list] of byFamily.entries()) {
    if (!FAMILY_ORDER.includes(family)) {
      groups.push({ family, label: FAMILY_LABEL[family], rows: list });
    }
  }
  return groups;
}
