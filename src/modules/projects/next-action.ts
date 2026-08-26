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
  | "AWAITING_APPROVAL"
  | "BUILD_QUOTATION"
  | "SEND_QUOTATION"
  | "AWAITING_ACCEPTANCE"
  | "CREATE_INVOICE"
  | "RECORD_ADVANCE"
  | "RAISE_PROCUREMENT"
  | "ALLOCATE_MATERIAL"
  | "MAKE_IN_PROGRESS"
  | "SCHEDULE_INSTALL"
  | "RESOLVE_SNAGS"
  | "PROJECT_COMPLETED"
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
  /** Owner canonical flow after quote acceptance: invoice → advance →
   *  install. When present, drives the ORDERED-stage CTA between
   *  "Create invoice", "Record advance", and "Book install". */
  money?: {
    invoiceTotal:    bigint;
    advanceReceived: bigint;
    advanceRequired: bigint;
  };
}

const PERM_CREATE_INVOICE  = ["invoice.create"] as const;
const PERM_RECORD_ADVANCE  = ["receipt.create"] as const;
const PERM_BOOK_INSTALL    = ["sitelog.create", "project.update"] as const;
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
    // Owner redesign (2026-08-26): pre-order internal stages route
    // straight to the normal invoice-creation page. No modal wizard,
    // no product picker inline — the owner asked for the simplest
    // flow: click "Create invoice" → land on /invoicing/new. If the
    // project has no invoiceable order yet, that page shows its
    // standard empty state.
    case "ENQUIRY":
    case "SITE_VISIT":
    case "MEASUREMENT":
    case "QUOTATION": {
      const enabled = hasAny(ctx, PERM_CREATE_INVOICE);
      return {
        kind:  "CREATE_INVOICE",
        label: "Create invoice",
        cta:   "Create invoice",
        enabled,
        disabledReason: enabled ? null :
          "Invoices are raised by the accounts team.",
        href: `/invoicing/new?project=${id}`,
      };
    }

    case "ORDERED": {
      // Owner canonical flow post-acceptance: Create invoice → collect
      // advance → book install. Procurement is background; it is not
      // the primary CTA here anymore. When money snapshot isn't loaded
      // we fall through to "Create invoice" (safe default; owner still
      // clicks through to the invoice picker).
      const m = project.money;
      const invoiced = m ? m.invoiceTotal > 0n : false;
      const advanceMet = m
        ? m.advanceRequired > 0n
            ? m.advanceReceived >= m.advanceRequired
            : m.advanceReceived > 0n
        : false;

      if (!invoiced) {
        const enabled = hasAny(ctx, PERM_CREATE_INVOICE);
        return {
          kind:  "CREATE_INVOICE",
          label: "Firm quote accepted",
          cta:   "Create invoice",
          enabled,
          disabledReason: enabled ? null :
            "Invoices are raised by the accounts team.",
          // Project-scope the picker so the owner doesn't have to find
          // their project in the global invoiceable-orders list.
          href: `/invoicing/new?project=${id}`,
          subLine: "Invoice → advance → install.",
        };
      }
      if (!advanceMet) {
        const enabled = hasAny(ctx, PERM_RECORD_ADVANCE);
        return {
          kind:  "RECORD_ADVANCE",
          label: "Invoice raised — awaiting advance",
          cta:   "Record advance receipt",
          enabled,
          disabledReason: enabled ? null :
            "Receipts are recorded by the accounts team.",
          // Pre-select the client so /accounts/new opens with their
          // outstanding invoices already loaded and the amount ready.
          href: clientId ? `/accounts/new?clientId=${clientId}` : `/accounts/new`,
          subLine: "Install is unlocked once the advance is in.",
        };
      }
      // Advance in. Book install as the next visible step, even before
      // MAKE catches up — matches owner flow (Task 7).
      const enabled = hasAny(ctx, PERM_BOOK_INSTALL);
      return {
        kind:  "SCHEDULE_INSTALL",
        label: "Advance received — ready to install",
        cta:   "Book install visit",
        enabled,
        disabledReason: enabled ? null :
          "Install visits are scheduled by the sales team.",
        href: `/site-visits/new?projectId=${id}&purpose=HANDOVER`,
      };
    }

    case "PROCUREMENT": {
      // Owner canonical flow (2026-08-25): after advance is received,
      // the next visible action is Book install visit — procurement
      // happens in the background via the stock-reservation flow and
      // shouldn't force the owner into the stock ledger.
      const enabled = hasAny(ctx, PERM_BOOK_INSTALL);
      return {
        kind:  "SCHEDULE_INSTALL",
        label: "Advance received — ready to install",
        cta:   "Book install visit",
        enabled,
        disabledReason: enabled ? null :
          "Install visits are scheduled by the sales team.",
        href: `/site-visits/new?projectId=${id}&purpose=HANDOVER`,
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
        kind:  "PROJECT_COMPLETED",
        label: "Project completed",
        cta:   "",
        enabled: false,
        disabledReason: null,
        href: null,
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

export {
  PROJECT_STAGES, STAGE_SHORT_LABEL,
  PROJECT_PHASES, PHASE_LABEL, PHASE_TARGET_STAGE,
  phaseForStage, phaseForStageWithMoney,
} from "./stage-phases";
export type { ProjectPhase, PhaseMoneySnapshot } from "./stage-phases";
