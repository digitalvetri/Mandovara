// Internal ProjectStage enum + customer-facing phase view.
//
// Owner redesign (2026-08-26): the visible stepper collapses from 6
// phases to 5 — Project → Invoice → Advance → Installation → Completed.
// Site visits and measurements are no longer stepper phases: they're
// anytime side-actions on the project page. The firm-quote step also
// disappears from the stepper (it stays under the hood as the mechanism
// that produces the invoiceable order + deducts stock).
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
  | "INVOICE"
  | "ADVANCE"
  | "INSTALLATION"
  | "COMPLETED";

export const PROJECT_PHASES: readonly ProjectPhase[] = [
  "PROJECT", "INVOICE", "ADVANCE", "INSTALLATION", "COMPLETED",
];

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  PROJECT:      "Project",
  INVOICE:      "Invoice",
  ADVANCE:      "Advance",
  INSTALLATION: "Installation",
  COMPLETED:    "Completed",
};

// The internal stage jumped to when the user clicks a phase in the
// stepper. The four pre-order internal stages all map back to ENQUIRY
// when the owner overrides to "Project" — leaving finer distinctions
// (site visit, measurement, quotation) to the side-actions.
export const PHASE_TARGET_STAGE: Record<ProjectPhase, string> = {
  PROJECT:      "ENQUIRY",
  INVOICE:      "ORDERED",
  ADVANCE:      "ORDERED",
  INSTALLATION: "PROCUREMENT",
  COMPLETED:    "COMPLETED",
};

// Coarse mapping used where no money snapshot is available (project
// list cards, generic pill). ORDERED collapses to INVOICE by default —
// the finer INVOICE-vs-ADVANCE split needs the money snapshot and lives
// in phaseForStageWithMoney below.
export function phaseForStage(stage: string): ProjectPhase | "CANCELLED" {
  switch (stage) {
    case "ENQUIRY":
    case "SITE_VISIT":
    case "MEASUREMENT":
    case "QUOTATION":
      return "PROJECT";
    case "ORDERED":
      return "INVOICE";
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

// Finer mapping for callers that hold the money snapshot (project
// detail page). When ORDERED, we split into INVOICE (nothing invoiced
// yet) or ADVANCE (invoice raised, waiting on payment).
export function phaseForStageWithMoney(
  stage: string,
  money: PhaseMoneySnapshot | null | undefined,
): ProjectPhase | "CANCELLED" {
  const base = phaseForStage(stage);
  if (base !== "INVOICE") return base;
  if (!money) return "INVOICE";
  return money.invoiceTotal > 0n ? "ADVANCE" : "INVOICE";
}
