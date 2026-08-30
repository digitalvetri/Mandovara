// Queries for /catalogues — the plain reference-list page. Reads from
// the dedicated Catalogue model, NOT the Brand / Collection tree that
// powers /products. See the "product catalog vs catalogues" note in
// user memory — they are separate systems by design.

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
  const rows = await db.catalogue.findMany({
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
  for (const [family, list] of byFamily.entries()) {
    if (!FAMILY_ORDER.includes(family)) {
      groups.push({ family, label: FAMILY_LABEL[family], rows: list });
    }
  }
  return groups;
}
