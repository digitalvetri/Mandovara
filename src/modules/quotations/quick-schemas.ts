// Zod schemas + types for the quick-quote action. Extracted out of
// quick-actions.ts because that file is "use server" — a
// server-action module can only export async functions, so
// non-async exports (types, Zod objects) have to live here.

import { z } from "zod";

const idField = z.string().min(20).max(64);
const mm      = z.number().positive().max(20_000);

export const quickLineSchema = z.object({
  // Optional since 2026-08-30 (owner): the Quick Quote form no longer
  // asks for a room. It still groups lines into a Room on the server —
  // MeasurementItem.roomId is not nullable — so an unnamed line lands in
  // "General", the same default the simple measurement entry uses.
  roomName:    z.string().trim().min(1).max(80).optional().default("General"),
  label:       z.string().trim().min(1).max(120),
  // Owner redesign (2026-08-26): width/height are no longer captured
  // in the Quick Quote — the sample estimates just say "MTR 25". When
  // they're absent, the server skips MeasurementItem creation and the
  // line becomes a straight qty-based estimate.
  widthMm:     mm.optional(),
  heightMm:    mm.optional(),
  quantity:    z.number().positive().max(999),
  colourwayId: idField.optional(),
  gstRate:     z.number().min(0).max(28).default(18),
  unit:        z.enum(["METRE","ROLL","SQFT","SQM","PIECE","SET","BOX","RUNNING_FT"]).default("METRE"),
  ratePaise:   z.string().min(1),
  discountPct: z.number().min(0).max(100).default(0),
  description: z.string().trim().max(240).optional(),
});
export type QuickLineInput = z.infer<typeof quickLineSchema>;

// FIXES-01 §5.1 — a quick quote is drafted against EITHER a lead
// (pre-conversion, no project) or a client (post-conversion, project
// created on the fly if needed). XOR the two paths.
export const quickQuoteSchema = z.object({
  leadId:         idField.optional(),
  clientId:       idField.optional(),
  projectId:      idField.optional(),
  newProjectName: z.string().trim().min(1).max(120).optional(),
  branchId:       idField,
  validForDays:   z.number().int().positive().max(365).default(30),
  discountPct:    z.number().min(0).max(100).default(0),
  termsText:      z.string().trim().max(2000).optional(),
  lines:          z.array(quickLineSchema).min(1).max(50),
}).refine(
  (d) => (d.leadId ? 1 : 0) + (d.clientId ? 1 : 0) === 1,
  { message: "Provide either leadId OR clientId, not both.", path: ["leadId"] },
).refine(
  (d) => d.leadId ? true : (d.projectId || d.newProjectName),
  { message: "For a client quote, either projectId or newProjectName is required.", path: ["projectId"] },
);
export type QuickQuoteInput = z.infer<typeof quickQuoteSchema>;
