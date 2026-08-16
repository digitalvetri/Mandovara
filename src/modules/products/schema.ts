// Zod schemas for the products module.
//
// A "product" in the UI = one Colourway row (a sellable SKU). The create
// action wires up its Brand → Collection → Design → Colourway chain in a
// single transaction, so this schema captures the minimum needed to
// stand up all four rows.

import { z } from "zod";

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// Mirrors the Prisma ProductFamily enum. Kept as a tuple so `z.enum` can
// use it directly; keep in sync with schema.prisma if that enum grows.
export const PRODUCT_FAMILIES = [
  "CURTAIN_FABRIC", "SHEER", "LINING", "BLIND", "WALLPAPER",
  "FLOORING", "CARPET_ROLL", "CARPET_TILE", "RUG",
  "UPHOLSTERY_FABRIC", "FOAM_FILLING", "VERTICAL_GARDEN",
  "INTERIOR_FILM", "MURAL", "HARDWARE_TRACK", "HARDWARE_ROD",
  "MOTOR", "ACCESSORY", "SERVICE",
] as const;
export type ProductFamilyKey = (typeof PRODUCT_FAMILIES)[number];

// Trade-friendly labels for the picker. The same labels are used by the
// listProducts filter rail (see queries.ts FAMILY_LABEL) — keep aligned.
export const FAMILY_OPTIONS: ReadonlyArray<{ value: ProductFamilyKey; label: string }> = [
  { value: "CURTAIN_FABRIC",   label: "Curtains" },
  { value: "SHEER",            label: "Sheer Curtains" },
  { value: "LINING",           label: "Curtain Lining" },
  { value: "BLIND",            label: "Blinds" },
  { value: "WALLPAPER",        label: "Wallpaper" },
  { value: "FLOORING",         label: "Flooring" },
  { value: "CARPET_ROLL",      label: "Carpets" },
  { value: "CARPET_TILE",      label: "Carpet Tiles" },
  { value: "RUG",              label: "Rugs" },
  { value: "UPHOLSTERY_FABRIC", label: "Upholstery Fabric" },
  { value: "FOAM_FILLING",     label: "Foam & Filling" },
  { value: "VERTICAL_GARDEN",  label: "Vertical Garden" },
  { value: "INTERIOR_FILM",    label: "Interior Films" },
  { value: "MURAL",            label: "Murals & Art" },
  { value: "HARDWARE_TRACK",   label: "Curtain Tracks" },
  { value: "HARDWARE_ROD",     label: "Curtain Rods" },
  { value: "MOTOR",            label: "Motors" },
  { value: "ACCESSORY",        label: "Accessories" },
  { value: "SERVICE",          label: "Services" },
];

// Mirrors the Prisma SellUnit enum.
export const SELL_UNITS = [
  "METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT",
] as const;
export type SellUnitKey = (typeof SELL_UNITS)[number];

export const SELL_UNIT_OPTIONS: ReadonlyArray<{ value: SellUnitKey; label: string }> = [
  { value: "METRE",      label: "Metre" },
  { value: "ROLL",       label: "Roll" },
  { value: "SQFT",       label: "Sq. Ft." },
  { value: "SQM",        label: "Sq. Metre" },
  { value: "PIECE",      label: "Piece" },
  { value: "SET",        label: "Set" },
  { value: "BOX",        label: "Box" },
  { value: "RUNNING_FT", label: "Running Foot" },
];

// GST slabs shown in the picker. Server accepts any 0–28% for exotic HSNs.
export const GST_SLABS = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

const hsnRegex = /^\d{4,8}$/;

export const createProductSchema = z.object({
  code:      z.string().trim().min(2, "Code is required").max(64),
  name:      z.string().trim().min(2, "Name is required").max(200),
  family:    z.enum(PRODUCT_FAMILIES),
  brandName: z.string().trim().min(1, "Brand is required").max(120),
  hsn:       z.string().trim().regex(hsnRegex, "HSN is 4–8 digits"),
  gstRate:   z.number().min(0).max(28),
  sellUnit:  z.enum(SELL_UNITS),
  mrp:       z.string().trim().min(1, "MRP is required"),
  cost:      z.string().trim().optional().or(z.literal("")),
});

// Standard size labels for the size-price editor. The tier string
// stored in Price is "SIZE:3x5" etc. so it clusters together and
// stays distinguishable from single-price tiers (MRP / COST / RETAIL).
export const RUG_SIZE_TIERS = ["3x5", "4x6", "5x7", "6x9", "RUNNER"] as const;
export type RugSizeTier = (typeof RUG_SIZE_TIERS)[number];
export const SIZE_TIER_PREFIX = "SIZE:";

// Rupee string ⇢ parsed server-side via parseINR. Empty string = row skipped.
const sizePriceRow = z.object({
  tier:  z.string().min(1).max(40),
  price: z.string().trim().max(20),
});
const extraSpecRow = z.object({
  key:   z.string().trim().min(1).max(60),
  value: z.string().trim().max(200),
});

export const updateProductSchema = z.object({
  id:       z.string().min(1),
  // ── basics
  code:     z.string().trim().min(2).max(64).optional(),
  name:     z.string().trim().min(2).max(200).optional(),
  hsn:      z.string().trim().regex(hsnRegex).optional(),
  gstRate:  z.number().min(0).max(28).optional(),
  sellUnit: z.enum(SELL_UNITS).optional(),
  // ── physical specs (Design columns)
  pileHeightMm: z.union([z.number().nonnegative().max(1000), z.literal("")])
                 .nullable().optional(),         // → Design.thicknessMm
  gsm:          z.union([z.number().int().nonnegative().max(1_000_000), z.literal("")])
                 .nullable().optional(),         // → Design.gsm
  // ── free-form specs (Design.specs JSON merge)
  pileYarn:  z.string().trim().max(200).optional(),
  points:    z.string().trim().max(50).optional(),
  extraSpecs: z.array(extraSpecRow).max(20).optional(),
  // ── size-priced tiers — replace-all semantics on the SIZE: prefix
  sizePrices: z.array(sizePriceRow).max(20).optional(),
  // ── cost price (single tier)
  cost: z.string().trim().optional().or(z.literal("")),
});

export const setStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(PRODUCT_STATUSES),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type SetStatusInput     = z.infer<typeof setStatusSchema>;
