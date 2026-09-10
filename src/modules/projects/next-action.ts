// Pure "what should the user do next?" resolver for the project detail
// hero card. Reads the project's stage plus the current user's
// permissions and returns the single primary action + disabled-reason
// message when the user isn't the right role.
//
// docs/BUILD-SPEC.md project-detail §2. The button is disabled with an
// explanatory line when the role cannot perform it — never hidden.
// "Hidden looks broken; disabled and explained shows respect."

import type { RequestContext } from "@/kernel/auth/context";

import { resolveMoneyStageAction } from "./next-action-money";

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
  /** Owner canonical flow after quote acceptance (2026-09-10): collect the
   *  advance → do the work → collect the balance → bill. When present, it
   *  drives the CTA between "Record payment", "Book install" and
   *  "Create invoice". */
  money?: {
    invoiceTotal:    bigint;
    advanceReceived: bigint;
    advanceRequired: bigint;
    /** What the client agreed to. Absent on callers that predate it. */
    agreedValue?:    bigint;
    /** Still to collect against that agreement. */
    outstanding?:    bigint;
  };
  /** True when the project has a quotation on it worth acting on. */
  hasQuotation?: boolean;
}

const PERM_CREATE_INVOICE  = ["invoice.create"] as const;
const PERM_RECORD_ADVANCE  = ["receipt.create"] as const;
const PERM_BOOK_INSTALL    = ["sitelog.create", "project.update"] as const;

export function hasAny(ctx: RequestContext, keys: readonly string[]): boolean {
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
    // Before the client has agreed a price, the next thing to do is put a
    // price in front of them — or, if one is already out, collect on it.
    //
    // This used to say "Create invoice" at every one of these stages, which
    // asked the owner to bill a client who had not yet agreed what the job
    // costs. That is the inversion the 2026-09-10 change removes: the
    // quotation comes first and the invoice comes last.
    // The money-driven half of the flow — quote, advance, balance, bill —
    // lives in ./next-action-money so this file stays inside the §10
    // 300-line limit and the sequence reads as one piece.
    case "ENQUIRY":
    case "SITE_VISIT":
    case "MEASUREMENT":
    case "QUOTATION":
    case "ORDERED":
      return resolveMoneyStageAction(ctx, project);

    case "PROCUREMENT": {
      // Owner canonical flow (2026-08-25): after advance is received,
      // the next visible action is Book install visit — procurement
      // happens in the background via the stock-reservation flow and
      // shouldn't force the owner into the stock ledger.
      //
      // The balance rides along in the subLine (2026-09-10). The advance
      // gate moves a project here on the first payment, which is the right
      // reading of "they get the advance and then the work starts" — but a
      // job three-quarters unpaid must not present itself as a job that is
      // simply waiting for a van.
      const enabled = hasAny(ctx, PERM_BOOK_INSTALL);
      const owed    = project.money?.outstanding ?? 0n;
      return {
        kind:  "SCHEDULE_INSTALL",
        label: "Advance received — ready to install",
        cta:   "Book install visit",
        enabled,
        disabledReason: enabled ? null :
          "Install visits are scheduled by the sales team.",
        href: `/site-visits/new?projectId=${id}&purpose=HANDOVER`,
        ...(owed > 0n ? { subLine: "Balance still to collect." } : {}),
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

    case "COMPLETED": {
      // The work is done, but the money story may not be. A finished job
      // with a balance outstanding is the single most expensive thing to
      // lose sight of, so it keeps a live action instead of going quiet.
      const m = project.money;
      const stillOwed = m?.outstanding ?? 0n;

      if (stillOwed > 0n) {
        const enabled = hasAny(ctx, PERM_RECORD_ADVANCE);
        return {
          kind:  "RECORD_ADVANCE",
          label: "Work done — balance to collect",
          cta:   "Record payment",
          enabled,
          disabledReason: enabled ? null :
            "Payments are recorded by the accounts team.",
          href: clientId ? `/accounts/new?clientId=${clientId}` : `/accounts/new`,
        };
      }
      if (m && m.invoiceTotal <= 0n && (m.agreedValue ?? 0n) > 0n) {
        const enabled = hasAny(ctx, PERM_CREATE_INVOICE);
        return {
          kind:  "CREATE_INVOICE",
          label: "Paid in full — ready to bill",
          cta:   "Create invoice",
          enabled,
          disabledReason: enabled ? null :
            "Invoices are raised by the accounts team.",
          href: `/invoicing/create?project=${id}`,
        };
      }
      return {
        kind:  "PROJECT_COMPLETED",
        label: "Project completed",
        cta:   "",
        enabled: false,
        disabledReason: null,
        href: null,
      };
    }

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
