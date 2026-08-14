// src/modules/catalog/schema.ts
import { z } from "zod";

// Enums matching Prisma (string literals, not Prisma-generated enum objects)
export const ProductFamilyEnum = z.enum([
  "CURTAIN_FABRIC",
  "SHEER",
  "LINING",
  "BLIND",
  "WALLPAPER",
  "FLOORING",
  "CARPET_ROLL",
  "CARPET_TILE",
  "RUG",
  "UPHOLSTERY_FABRIC",
  "FOAM_FILLING",
  "VERTICAL_GARDEN",
  "INTERIOR_FILM",
  "MURAL",
  "HARDWARE_TRACK",
  "HARDWARE_ROD",
  "MOTOR",
  "ACCESSORY",
  "SERVICE",
]);

export const PatternMatchEnum = z.enum(["FREE", "STRAIGHT", "OFFSET"]);

export const SellUnitEnum = z.enum([
  "METRE",
  "ROLL",
  "SQFT",
  "SQM",
  "PIECE",
  "SET",
  "BOX",
  "RUNNING_FT",
]);

export const BrandSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().max(60).optional(),
  leadTimeDays: z.number().int().min(1).max(365).default(14),
  vendorId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const CollectionSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(120),
  family: ProductFamilyEnum,
  seasonYear: z.number().int().min(2000).max(2100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const DesignSchema = z.object({
  collectionId: z.string().min(1),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  family: ProductFamilyEnum,
  rollWidthMm: z.number().positive().optional().nullable(),
  rollLengthM: z.number().positive().optional().nullable(),
  fabricWidthMm: z.number().positive().optional().nullable(),
  patternRepeatMm: z.number().min(0).optional().nullable(),
  patternMatch: PatternMatchEnum.default("FREE"),
  railroadable: z.boolean().default(false),
  gsm: z.number().int().positive().optional().nullable(),
  thicknessMm: z.number().positive().optional().nullable(),
  areaPerBoxSqft: z.number().positive().optional().nullable(),
  tileSizeMm: z.string().max(20).optional().nullable(),
  specs: z.record(z.string(), z.unknown()).default({}),
  hsn: z.string().min(4).max(8),
  gstRate: z.number().min(0).max(28),
  isActive: z.boolean().default(true),
});

export const ColourwaySchema = z.object({
  designId: z.string().min(1),
  code: z.string().min(1).max(60),
  colourName: z.string().min(1).max(80),
  hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  sellUnit: SellUnitEnum,
  moq: z.number().positive().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const PriceSchema = z.object({
  colourwayId: z.string().min(1),
  tier: z.enum(["COST", "MRP", "RETAIL", "ARCHITECT", "PROJECT"]),
  clientId: z.string().min(1).optional().nullable(),
  amount: z.bigint().positive(),
  minChargeSqft: z.number().positive().optional().nullable(),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional().nullable(),
});

// Search / list params
export const DesignSearchParams = z.object({
  q: z.string().optional(),
  family: ProductFamilyEnum.optional(),
  brandId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  inStock: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

export type BrandInput = z.infer<typeof BrandSchema>;
export type CollectionInput = z.infer<typeof CollectionSchema>;
export type DesignInput = z.infer<typeof DesignSchema>;
export type ColourwayInput = z.infer<typeof ColourwaySchema>;
export type PriceInput = z.infer<typeof PriceSchema>;
export type DesignSearchParamsInput = z.infer<typeof DesignSearchParams>;
