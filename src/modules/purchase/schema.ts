import { z } from "zod";

// Matches frozen schema POStatus enum: DRAFT SENT PARTIAL RECEIVED CANCELLED
export const PO_STATUSES = ["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"] as const;
export type POStatus = (typeof PO_STATUSES)[number];

// SellUnit enum values (subset used in POs)
export const SELL_UNITS = ["METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

// ── PO creation ───────────────────────────────────────────────────────────────

export const poLineInput = z.object({
  colourwayId: z.string().cuid("Pick a colourway"),
  unit:        z.enum(SELL_UNITS),
  quantity:    z.number().positive("Quantity must be > 0"),
  rate:        z.string().trim().min(1, "Rate is required"),   // INR string, parsed server-side
});

export const createPOSchema = z.object({
  vendorId:   z.string().cuid("Pick a vendor"),
  date:       isoDate,
  expectedAt: isoDate.optional(),
  projectId:  z.string().cuid().optional(),
  lines:      z.array(poLineInput).min(1, "At least one line required"),
});

// ── Status transitions ────────────────────────────────────────────────────────

export const setPOStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(["SENT", "CANCELLED"]),  // DRAFT→SENT (approve); any→CANCELLED
});

// ── GRN posting ───────────────────────────────────────────────────────────────

export const grnLineInput = z.object({
  colourwayId:  z.string().cuid(),
  quantity:     z.number().positive("Quantity must be > 0"),
  dyeLot:       z.string().trim().max(80).optional().or(z.literal("")),
  binLocation:  z.string().trim().max(120).optional().or(z.literal("")),
  rollCount:    z.number().int().positive().optional(),
  rollLengthsM: z.array(z.number().positive()).optional(),
});

export const postGRNSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  receivedAt:      isoDate,
  invoiceRef:      z.string().trim().max(80).optional().or(z.literal("")),
  lines:           z.array(grnLineInput).min(1, "Receive at least one line"),
});

export type CreatePOInput  = z.infer<typeof createPOSchema>;
export type PostGRNInput   = z.infer<typeof postGRNSchema>;
export type SetPOStatusInput = z.infer<typeof setPOStatusSchema>;
