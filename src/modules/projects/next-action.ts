// Pure "what should the user do next?" resolver for the project detail
// hero card. Reads the project's stage plus the current user's
// permissions and returns the single primary action + disabled-reason
// message when the user isn't the right role.
//
// docs/BUILD-SPEC.md project-detail §2. The button is disabled with an
// explanatory line when the role cannot perform it — never hidden.
// "Hidden looks broken; disabled and explained shows respect."

import type { RequestContext } from "@/kernel/auth/context";

export type NextActionKind =
  | "SCHEDULE_VISIT"
  | "START_MEASUREMENT"
  | "AWAITING_APPROVAL"
  | "BUILD_QUOTATION"
  | "SEND_QUOTATION"
  | "AWAITING_ACCEPTANCE"
  | "RAISE_PROCUREMENT"
  | "ALLOCATE_MATERIAL"
  | "MAKE_IN_PROGRESS"
  | "SCHEDULE_INSTALL"
  | "RESOLVE_SNAGS"
  | "REQUEST_REVIEW"
  | "PROJECT_CANCELLED"
  | "COMPLETED";

export interface NextAction {
  kind: NextActionKind;
  label: string;
  cta: string;
  /** True when the user CAN perform this action; false → button disabled + reason. */
  enabled: boolean;
  disabledReason: string | null;
  /** Route for the primary CTA (absolute path). null when the action isn't clickable. */
  href: string | null;
  /** Optional secondary line under the button (progress, counts). */
  subLine?: string;
}

export interface ProjectSnapshot {
  id: string;
  clientId?: string;
  stage: string;
  openSnags?: number;
  makeInProgress?: { done: number; total: number };
}

const PERM_START_MEASUREMENT = [
  "measurement.create.any", "measurement.create.own", "measurement.create",
] as const;
const PERM_BUILD_QUOTATION = ["quotation.create"] as const;
const PERM_SEND_QUOTATION  = ["quotation.send"]   as const;
const PERM_STOCK           = ["stock.view"] as const;   // what /inventory gates on
function hasAny(ctx: RequestContext, keys: readonly string[]): boolean {
  for (const k of keys) if (ctx.permissions.has(k as never)) return true;
  return false;
}

export function resolveNextAction(
  ctx: RequestContext,
  project: ProjectSnapshot,
): NextAction {
  const { stage, id, clientId } = project;

  switch (stage) {
    case "ENQUIRY":
      // href is set to the project itself but the click is intercepted
      // by NextActionCard via onScheduleVisit — it opens an inline sheet
      // that pre-fills the projectId, so no navigation is required.
      return {
        kind:  "SCHEDULE_VISIT",
        label: "Schedule a site visit",
        cta:   "Schedule visit",
        enabled: hasAny(ctx, ["project.update", "sitelog.create"]),
        disabledReason: hasAny(ctx, ["project.update", "sitelog.create"]) ? null :
          "Site visits are scheduled by the sales team.",
        href: null,
      };

    case "SITE_VISIT":
    case "MEASUREMENT": {
      const enabled = hasAny(ctx, PERM_START_MEASUREMENT);
      return {
        kind:  "START_MEASUREMENT",
        label: "Take measurements",
        cta:   "Start measurement",
        enabled,
        disabledReason: enabled ? null :
          "Measurement is captured on site by the measurement team.",
        // The button routes via a server action; a fallback href goes to
        // the measurement list so a mid-permission user can still browse.
        href: `/projects/${id}/measurements`,
      };
    }

    case "QUOTATION": {
      const enabled = hasAny(ctx, PERM_BUILD_QUOTATION) || hasAny(ctx, PERM_SEND_QUOTATION);
      return {
        kind:  "BUILD_QUOTATION",
        label: "Build the quotation",
        cta:   "Open quotations",
        enabled,
        disabledReason: enabled ? null :
          "Quotations are prepared by sales / designers.",
        href: `/quotations?project=${id}`,
      };
    }

    case "ORDERED":
      // Advance-Awaited phase (Batch A). Quote is accepted but the
      // advance hasn't landed yet — that gate lands in Batch B. For
      // now, still surface the procurement console since that's where
      // the owner readies stock. Once Batch B ships, this changes to
      // "Collect the advance" as the primary CTA.
      return {
        kind:  "RAISE_PROCUREMENT",
        label: "Awaiting advance payment",
        cta:   "Prepare material",
        enabled: hasAny(ctx, ["po.create", "requisition.create", "project.materialIssue"]),
        disabledReason: hasAny(ctx, ["po.create", "requisition.create", "project.materialIssue"]) ? null :
          "Material preparation is handled by the store team.",
        href: `/projects/${id}/procurement`,
      };

    case "PROCUREMENT": {
      const enabled = hasAny(ctx, PERM_STOCK);
      return {
        kind:  "ALLOCATE_MATERIAL",
        label: "Material in procurement",
        cta:   "Open stock ledger",
        enabled,
        disabledReason: enabled ? null :
          "Stock is handled by the store team.",
        href: `/inventory`,
      };
    }

    case "MAKE": {
      // When every make job is done, the natural next action is to book
      // the install visit — no more auto-schedule at +3 days (owner
      // asked for that removed 25 Aug 2026). If work is still in
      // progress, surface the make-queue CTA as before.
      const allDone =
        project.makeInProgress != null &&
        project.makeInProgress.total > 0 &&
        project.makeInProgress.done >= project.makeInProgress.total;
      if (allDone) {
        return {
          kind:  "SCHEDULE_INSTALL",
          label: "Ready to install",
          cta:   "Book install visit",
          enabled: hasAny(ctx, ["sitelog.create", "project.update"]),
          disabledReason: hasAny(ctx, ["sitelog.create", "project.update"]) ? null :
            "Install visits are scheduled by the sales team.",
          href: `/site-visits/new?projectId=${id}&purpose=HANDOVER`,
        };
      }
      return {
        kind:  "MAKE_IN_PROGRESS",
        label: "Cut & stitch in progress",
        cta:   "Open make queue",
        enabled: hasAny(ctx, ["make.view"]),
        disabledReason: null,
        href: `/make`,
        subLine: project.makeInProgress
          ? `${project.makeInProgress.done} of ${project.makeInProgress.total} done`
          : undefined,
      };
    }

    case "COMPLETED":
      return {
        kind:  "REQUEST_REVIEW",
        label: "Request a client review",
        cta:   "Send review request",
        enabled: hasAny(ctx, ["client.viewOthers"]),
        disabledReason: null,
        href: clientId ? `/clients/${clientId}` : `/projects/${id}`,
      };

    case "CANCELLED":
      return {
        kind:  "PROJECT_CANCELLED",
        label: "This project was cancelled",
        cta:   "",
        enabled: false,
        disabledReason: "No further actions available.",
        href: null,
      };

    default:
      return {
        kind:  "COMPLETED",
        label: "Nothing outstanding",
        cta:   "",
        enabled: false,
        disabledReason: null,
        href: null,
      };
  }
}

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
