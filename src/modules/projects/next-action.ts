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
  stage: string;
  openSnags?: number;
  makeInProgress?: { done: number; total: number };
}

const PERM_START_MEASUREMENT = [
  "measurement.create.any", "measurement.create.own", "measurement.create",
] as const;
const PERM_BUILD_QUOTATION = ["quotation.create"] as const;
const PERM_SEND_QUOTATION  = ["quotation.send"]   as const;
const PERM_ALLOCATE        = ["allocation.create"] as const;
const PERM_SCHEDULE_INSTALL = ["install.create"]  as const;

function hasAny(ctx: RequestContext, keys: readonly string[]): boolean {
  for (const k of keys) if (ctx.permissions.has(k as never)) return true;
  return false;
}

export function resolveNextAction(
  ctx: RequestContext,
  project: ProjectSnapshot,
): NextAction {
  const { stage, id } = project;

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
        href: `/quotations`,
      };
    }

    case "ORDERED":
      return {
        kind:  "RAISE_PROCUREMENT",
        label: "Raise purchase requests",
        cta:   "Open procurement",
        enabled: hasAny(ctx, ["po.create", "requisition.create"]),
        disabledReason: hasAny(ctx, ["po.create", "requisition.create"]) ? null :
          "Purchase orders are raised by the store team.",
        href: `/purchase`,
      };

    case "PROCUREMENT": {
      const enabled = hasAny(ctx, PERM_ALLOCATE);
      return {
        kind:  "ALLOCATE_MATERIAL",
        label: "Allocate material",
        cta:   "Open allocation console",
        enabled,
        disabledReason: enabled ? null :
          "Dye-lot allocation is handled by the store team.",
        href: `/inventory`,
      };
    }

    case "MAKE":
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

    case "INSTALLATION": {
      const enabled = hasAny(ctx, PERM_SCHEDULE_INSTALL);
      return {
        kind:  "SCHEDULE_INSTALL",
        label: "Schedule installation",
        cta:   "Open install calendar",
        enabled,
        disabledReason: enabled ? null :
          "Installation scheduling is handled by the install team.",
        href: `/install`,
      };
    }

    case "SNAGGING":
      return {
        kind:  "RESOLVE_SNAGS",
        label: project.openSnags && project.openSnags > 0
          ? `${project.openSnags} open snag${project.openSnags === 1 ? "" : "s"}`
          : "Resolve snags",
        cta:   "Open snag register",
        enabled: hasAny(ctx, ["install.raiseSnag", "install.view"]),
        disabledReason: null,
        href: `/install`,
      };

    case "COMPLETED":
      return {
        kind:  "REQUEST_REVIEW",
        label: "Request a client review",
        cta:   "Send review request",
        enabled: hasAny(ctx, ["client.viewOthers"]),
        disabledReason: null,
        href: `/clients/${id}`,
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
  "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING", "COMPLETED",
];

export const STAGE_SHORT_LABEL: Record<string, string> = {
  ENQUIRY:      "Enquiry",
  SITE_VISIT:   "Site Visit",
  MEASUREMENT:  "Measure",
  QUOTATION:    "Quote",
  ORDERED:      "Order",
  PROCUREMENT:  "Procure",
  MAKE:         "Make",
  INSTALLATION: "Install",
  SNAGGING:     "Snag",
  COMPLETED:    "Done",
  CANCELLED:    "Cancelled",
};
