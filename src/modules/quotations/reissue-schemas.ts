// Schemas + pure rules for reissuing an estimate as a firm quotation.
// Separate from reissue-actions.ts, which is "use server" and may therefore
// only export async functions.

import { z } from "zod";

export const reissueSchema = z.object({
  quotationId: z.string().min(1),
});
export type ReissueInput = z.infer<typeof reissueSchema>;

export interface ReissuePrecheck {
  ok: boolean;
  reason?: string;
}

/**
 * Can this quotation be reissued as a firm quotation?
 *
 * Kept pure so the button can explain itself before anything is clicked —
 * §10 errors must name the next action, not just refuse.
 */
export function canReissue(q: {
  isEstimate: boolean;
  projectId: string | null;
  approvedMeasurementItems: number;
  /** Source status — a REVISED estimate has already been reissued. */
  status?: string;
}): ReissuePrecheck {
  if (q.status === "REVISED") {
    return {
      ok: false,
      reason: "This estimate has already been reissued — open the newer revision.",
    };
  }
  if (!q.isEstimate) {
    return { ok: false, reason: "This is already a measured quotation." };
  }
  if (!q.projectId) {
    return {
      ok: false,
      reason: "Convert the lead to a client first — a firm quotation hangs off a project.",
    };
  }
  if (q.approvedMeasurementItems === 0) {
    return {
      ok: false,
      reason: "No approved measurement on this project yet. Measure the site and approve the round, then reissue.",
    };
  }
  return { ok: true };
}

/** Line description for a measured item: "Master Bedroom · Window 1 — Curtain". */
export function measuredLineDescription(
  roomName: string, label: string, family: string,
): string {
  const pretty = family.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${roomName} · ${label} — ${pretty}`.slice(0, 500);
}
