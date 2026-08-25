// Internal ProjectStage enum + customer-facing 6-phase view. Extracted
// from next-action.ts to keep that file under the 300-line ceiling
// (CLAUDE.md §10). No behaviour changed on the 25 Aug 2026 split.

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

// Customer-facing 6-phase view (25 Aug 2026 owner redesign, Batch A).
// The old Order / Procurement / Make substates roll into two phases:
//   ADVANCE_AWAITED  — quote accepted, waiting on advance payment
//   INSTALLATION     — advance received, work + install in progress
// Advance is the physical gate to installation (Batch B enforces it).
export type ProjectPhase =
  | "ENQUIRY"
  | "MEASUREMENT"
  | "QUOTATION"
  | "ADVANCE_AWAITED"
  | "INSTALLATION"
  | "COMPLETED";

export const PROJECT_PHASES: readonly ProjectPhase[] = [
  "ENQUIRY", "MEASUREMENT", "QUOTATION", "ADVANCE_AWAITED", "INSTALLATION", "COMPLETED",
];

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  ENQUIRY:          "Enquiry",
  MEASUREMENT:      "Measurement",
  QUOTATION:        "Quotation",
  ADVANCE_AWAITED:  "Advance Awaited",
  INSTALLATION:     "Installation",
  COMPLETED:        "Completed",
};

// The first internal stage jumped to when the user clicks a phase in the
// stepper — lets a manual override still map cleanly onto ProjectStage.
// Internal enum unchanged: ORDERED holds the "quote accepted, advance
// pending" state; PROCUREMENT/MAKE cover "installation in progress".
export const PHASE_TARGET_STAGE: Record<ProjectPhase, string> = {
  ENQUIRY:          "ENQUIRY",
  MEASUREMENT:      "MEASUREMENT",
  QUOTATION:        "QUOTATION",
  ADVANCE_AWAITED:  "ORDERED",
  INSTALLATION:     "PROCUREMENT",
  COMPLETED:        "COMPLETED",
};

export function phaseForStage(stage: string): ProjectPhase | "CANCELLED" {
  switch (stage) {
    case "ENQUIRY":
    case "SITE_VISIT":
      return "ENQUIRY";
    case "MEASUREMENT":
      return "MEASUREMENT";
    case "QUOTATION":
      return "QUOTATION";
    case "ORDERED":
      return "ADVANCE_AWAITED";
    case "PROCUREMENT":
    case "MAKE":
      return "INSTALLATION";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "ENQUIRY";
  }
}
