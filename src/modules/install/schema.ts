// Zod schemas for the install module.
//
// Money = paise (unchanged). Quantities are already stored on
// InstallLine.plannedQty (from OrderLine.orderedQty) so
// completeInstallLine only takes the DELTA that was installed on
// this visit, plus optional per-line evidence (dye lot, photos,
// remote serials, issue note).

import { z } from "zod";

export const INSTALL_STATUSES = [
  "SCHEDULED", "IN_PROGRESS", "COMPLETED", "PARTIAL", "RESCHEDULED", "CANCELLED",
] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

const isoDate = z.string().datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

// ── Create a visit for an order ──────────────────────────────────
export const createInstallVisitSchema = z.object({
  salesOrderId: z.string().cuid(),
  scheduledAt:  isoDate,
  crewId:       z.string().cuid().optional(),
  // Optional pre-selected order lines to include. If omitted we
  // create InstallLines from EVERY OrderLine with pending qty.
  orderLineIds: z.array(z.string().cuid()).optional(),
  notes:        z.string().trim().max(500).optional(),
});
export type CreateInstallVisitInput = z.infer<typeof createInstallVisitSchema>;

// ── Assign or re-assign a crew ───────────────────────────────────
export const assignCrewSchema = z.object({
  visitId: z.string().cuid(),
  crewId:  z.string().cuid().nullable(),   // null → unassign
});
export type AssignCrewInput = z.infer<typeof assignCrewSchema>;

// ── Start the visit (SCHEDULED → IN_PROGRESS) ────────────────────
export const startVisitSchema = z.object({
  visitId: z.string().cuid(),
});
export type StartVisitInput = z.infer<typeof startVisitSchema>;

// ── Complete a line (installed qty + evidence) ───────────────────
export const completeInstallLineSchema = z.object({
  lineId:        z.string().cuid(),
  // Positive; server enforces sum ≤ orderLine.orderedQty across all
  // visits.
  installedQty:  z.number({ error: "must be a number" }).positive("must be > 0"),
  dyeLotUsed:    z.string().trim().max(64).optional(),
  photoKeys:     z.array(z.string()).max(20).optional(),
  remoteSerials: z.array(z.string()).max(20).optional(),
  issue:         z.string().trim().max(500).optional(),
});
export type CompleteInstallLineInput = z.infer<typeof completeInstallLineSchema>;

// ── Capture the client signature (Supabase storage key) ─────────
// Phase 5c-office accepts a plain storage key. Phase 5c-PWA sends
// base64 data URLs (~30-80KB "data:image/png;base64,..."), because
// there's no storage bucket wired yet. Widen the max to accommodate
// both — the storage-bucket migration later replaces the value
// with a real key without changing this action's contract.
export const captureSignatureSchema = z.object({
  visitId:      z.string().cuid(),
  signatureKey: z.string().trim().min(1).max(200_000),
});
export type CaptureSignatureInput = z.infer<typeof captureSignatureSchema>;

// ── Sign + complete in one atomic write (§14 Phase 5 gate) ──────
// The PWA outbox emits ONE of these per visit at the moment the
// installer taps "Complete". Bundles the captureSignature and
// completeVisit gates into one server tx so a partial sync can't
// leave a signed-but-not-completed visit orphaned in the queue.
export const signAndCompleteVisitSchema = z.object({
  visitId:      z.string().cuid(),
  signatureKey: z.string().trim().min(1).max(200_000),
  outcome:      z.enum(["COMPLETED", "PARTIAL"]).default("COMPLETED"),
});
export type SignAndCompleteVisitInput = z.infer<typeof signAndCompleteVisitSchema>;

// ── Mark visit COMPLETED (soft gate: signature + at least one line) ─
export const completeVisitSchema = z.object({
  visitId: z.string().cuid(),
  // PARTIAL is picked when the client asks to schedule the rest for
  // a later date; we still write completedAt so aged widgets work.
  outcome: z.enum(["COMPLETED", "PARTIAL"]).default("COMPLETED"),
});
export type CompleteVisitInput = z.infer<typeof completeVisitSchema>;

// ── Raise a snag from within a visit ────────────────────────────
export const raiseSnagOnVisitSchema = z.object({
  visitId:     z.string().cuid(),
  location:    z.string().trim().min(1).max(200),  // matches SnagItem.location (roomLabel)
  description: z.string().trim().min(1).max(1000),
  photoKeys:   z.array(z.string()).max(20).optional(),
});
export type RaiseSnagOnVisitInput = z.infer<typeof raiseSnagOnVisitSchema>;
