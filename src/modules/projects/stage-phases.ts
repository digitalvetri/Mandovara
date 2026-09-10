// Internal ProjectStage enum + customer-facing phase view.
//
// Owner redesign (2026-08-26): the visible stepper collapses from 6
// phases to 5. Site visits and measurements are no longer stepper phases:
// they're anytime side-actions on the project page.
//
// Owner correction (2026-09-10): the five phases were
// Project → Invoice → Advance → Installation → Completed, which put the
// bill BEFORE the money. That is not how the studio works and it is not
// how any of its clients experience a job. The real sequence is:
//
//   quote it → they agree and pay an advance → do the work → collect the
//   rest → and only then raise the tax invoice.
//
// So the stepper now reads Project → Quotation → Advance → Installation →
// Completed, with billing sitting at the end of the job as the closing
// act rather than announcing itself in the middle of one.
//
// The internal ProjectStage enum is unchanged so legacy in-flight
// projects, Prisma schema, and cross-module references (milestones,
// automation, reports) keep working.

export const PROJECT_STAGES: readonly string[] = [
  "ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION", "ORDERED",
  "PROCUREMENT", "MAKE", "COMPLETED",
];

export const STAGE_SHORT_LABEL: Record<string, string> = {
  ENQUIRY:      "Enquiry",
  SITE_VISIT:   "Site Visit",
  MEASUREMENT:  "Measure",
  QUOTATION:    "Quote",
  ORDERED:      "Order",
  PROCUREMENT:  "Procure",
  MAKE:         "Make",
  COMPLETED:    "Done",
  CANCELLED:    "Cancelled",
};

// Customer-facing 5-phase view.
export type ProjectPhase =
  | "PROJECT"
  | "QUOTATION"
  | "ADVANCE"
  | "INSTALLATION"
  | "COMPLETED";

export const PROJECT_PHASES: readonly ProjectPhase[] = [
  "PROJECT", "QUOTATION", "ADVANCE", "INSTALLATION", "COMPLETED",
];

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  PROJECT:      "Project",
  QUOTATION:    "Quotation",
  ADVANCE:      "Payment",
  INSTALLATION: "Installation",
  COMPLETED:    "Completed",
};

// The internal stage jumped to when the user clicks a phase in the
// stepper. The four pre-order internal stages all map back to ENQUIRY
// when the owner overrides to "Project" — leaving finer distinctions
// (site visit, measurement, quotation) to the side-actions.
export const PHASE_TARGET_STAGE: Record<ProjectPhase, string> = {
  PROJECT:      "ENQUIRY",
  QUOTATION:    "QUOTATION",
  ADVANCE:      "ORDERED",
  INSTALLATION: "PROCUREMENT",
  COMPLETED:    "COMPLETED",
};

// Coarse mapping used where no money snapshot is available (project
// list cards, generic pill). The internal QUOTATION stage now has a phase
// of its own — the client is looking at a price and has not yet said yes,
// which is a real and visible state of a job. ORDERED means they said yes
// and the advance is awaited.
export function phaseForStage(stage: string): ProjectPhase | "CANCELLED" {
  switch (stage) {
    case "ENQUIRY":
    case "SITE_VISIT":
    case "MEASUREMENT":
      return "PROJECT";
    case "QUOTATION":
      return "QUOTATION";
    case "ORDERED":
      return "ADVANCE";
    case "PROCUREMENT":
    case "MAKE":
      return "INSTALLATION";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PROJECT";
  }
}

export interface PhaseMoneySnapshot {
  invoiceTotal:    bigint;
  advanceReceived: bigint;
  advanceRequired: bigint;
}

// Finer mapping for callers that hold the money snapshot (project detail
// page). A job still sitting at the internal QUOTATION stage but with
// money already received has plainly been agreed — the client paid — so
// it shows as Payment rather than leaving the stepper a step behind
// reality. Previously this split ORDERED into Invoice-then-Advance, which
// is the sequence the owner asked us to drop.
export function phaseForStageWithMoney(
  stage: string,
  money: PhaseMoneySnapshot | null | undefined,
): ProjectPhase | "CANCELLED" {
  const base = phaseForStage(stage);
  if (base !== "QUOTATION") return base;
  if (!money) return "QUOTATION";
  return money.advanceReceived > 0n ? "ADVANCE" : "QUOTATION";
}
