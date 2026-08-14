// Zod schemas + types for the quick-quote action. Extracted out of
// quick-actions.ts because that file is "use server" — a
// server-action module can only export async functions, so
// non-async exports (types, Zod objects) have to live here.

import { z } from "zod";

const idField = z.string().min(20).max(64);
const mm      = z.number().positive().max(20_000);

export const quickLineSchema = z.object({
  roomName:    z.string().trim().min(1).max(80),
  label:       z.string().trim().min(1).max(120),
  widthMm:     mm,
  heightMm:    mm,
  quantity:    z.number().positive().max(999),
  colourwayId: idField,
  ratePaise:   z.string().min(1),
  discountPct: z.number().min(0).max(100).default(0),
  description: z.string().trim().max(240).optional(),
});
export type QuickLineInput = z.infer<typeof quickLineSchema>;

export const quickQuoteSchema = z.object({
  clientId:       idField,
  projectId:      idField.optional(),
  newProjectName: z.string().trim().min(1).max(120).optional(),
  branchId:       idField,
  validForDays:   z.number().int().positive().max(365).default(30),
  discountPct:    z.number().min(0).max(100).default(0),
  termsText:      z.string().trim().max(2000).optional(),
  lines:          z.array(quickLineSchema).min(1).max(50),
}).refine((d) => d.projectId || d.newProjectName, {
  message: "Either projectId or newProjectName is required.",
  path:    ["projectId"],
});
export type QuickQuoteInput = z.infer<typeof quickQuoteSchema>;
