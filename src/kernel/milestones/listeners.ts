// Milestone auto-completion listeners.
//
// Wires domain events to Milestone.status updates. Every listener maps
// one event → the milestone whose template's `autoCompleteOn` names that
// event → mark autoCompleted + completedAt.
//
// Two listeners do more than tick:
//   - measurement.approved also advances the project stage to QUOTATION.
//   - advance.received only ticks when totalReceived >= advanceRequired.
//
// Registration lives in `registerMilestoneListeners()` — called once at
// process boot from `src/kernel/events/register.ts`. Idempotent: calling
// twice is a no-op because bus subscriptions dedupe by handler identity.

import { orgPrisma } from "@/kernel/db/rls";
import { bus } from "@/kernel/events/bus";
import type {
  AdvanceReceivedEvent,
  AllocationCompleteEvent,
  GrnReceivedEvent,
  InstallVisitCompletedEvent,
  MakeJobQcPassedEvent,
  MeasurementApprovedEvent,
  QuotationAcceptedEvent,
  SiteVisitCompletedEvent,
} from "@/kernel/events/types";

// ── Helper ─────────────────────────────────────────────────
// Auto-complete every PENDING milestone on `projectId` whose
// sourceEvent matches `event`. Optionally filter by ProductFamily
// (for the *_INWARD milestones which are family-specific).
async function completeMilestonesByEvent(
  orgId: string,
  projectId: string,
  event: string,
  families?: readonly string[] | null,
): Promise<void> {
  const where: Record<string, unknown> = {
    projectId,
    status: "PENDING",
    sourceEvent: event,
  };
  if (families && families.length > 0) {
    where["family"] = { in: families };
  }

  await orgPrisma(orgId).milestone.updateMany({
    where,
    data: {
      status:        "COMPLETED",
      autoCompleted: true,
      actualDate:    new Date(),
      completedAt:   new Date(),
    },
  });
}

// ── Handlers ───────────────────────────────────────────────
async function onSiteVisitCompleted(e: SiteVisitCompletedEvent): Promise<void> {
  await completeMilestonesByEvent(e.orgId, e.projectId, "siteVisit.completed");
}

async function onMeasurementApproved(e: MeasurementApprovedEvent): Promise<void> {
  await completeMilestonesByEvent(e.orgId, e.projectId, "measurement.approved");

  // Advance project stage to QUOTATION — but only if it's still in an
  // earlier stage. Never regress a project that's already past QUOTATION.
  const project = await orgPrisma(e.orgId).project.findUnique({
    where:  { id: e.projectId },
    select: { stage: true },
  });
  if (!project) return;
  const stagesBefore: readonly string[] = ["ENQUIRY", "SITE_VISIT", "MEASUREMENT"];
  if (stagesBefore.includes(project.stage)) {
    await orgPrisma(e.orgId).project.update({
      where: { id: e.projectId },
      data:  { stage: "QUOTATION" },
    });
  }
}

async function onQuotationAccepted(e: QuotationAcceptedEvent): Promise<void> {
  // Look up projectId from the quotation — the event carries only quotationId.
  const q = await orgPrisma(e.orgId).quotation.findUnique({
    where:  { id: e.quotationId },
    select: { projectId: true },
  });
  if (!q) return;
  // Lead-scoped quotations (FIXES-01 §5.1) have no projectId — nothing to
  // tick or advance yet. The conversion step handles the milestone chain
  // once a project exists.
  if (!q.projectId) return;
  await completeMilestonesByEvent(e.orgId, q.projectId, "quotation.accepted");

  // Advance project stage to ORDERED so the 4-phase UI moves from
  // "Measurement" (QUOTATION lives inside that phase) to "Installation".
  // Guarded — never regress a project past ORDERED.
  const project = await orgPrisma(e.orgId).project.findUnique({
    where:  { id: q.projectId },
    select: { stage: true },
  });
  if (!project) return;
  const stagesBefore: readonly string[] = ["ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION"];
  if (stagesBefore.includes(project.stage)) {
    await orgPrisma(e.orgId).project.update({
      where: { id: q.projectId },
      data:  { stage: "ORDERED" },
    });
  }
}

async function onAdvanceReceived(e: AdvanceReceivedEvent): Promise<void> {
  // Conditional completion — only fire when total received meets the
  // required threshold. Partial advances never tick this milestone.
  if (e.totalReceivedForProject < e.advanceRequired) return;
  await completeMilestonesByEvent(e.orgId, e.projectId, "advance.received");
}

async function onGrnReceived(e: GrnReceivedEvent): Promise<void> {
  // Family-specific: FABRIC_INWARD (curtain/sheer), ROLL_INWARD (wallpaper),
  // MATERIAL_INWARD (flooring). Every match completes if pending.
  await completeMilestonesByEvent(e.orgId, e.projectId, "grn.received", e.families);
}

async function onAllocationComplete(e: AllocationCompleteEvent): Promise<void> {
  await completeMilestonesByEvent(e.orgId, e.projectId, "allocation.complete");
}

async function onMakeJobQcPassed(e: MakeJobQcPassedEvent): Promise<void> {
  await completeMilestonesByEvent(e.orgId, e.projectId, "makeJob.qcPassed");
}

async function onInstallVisitCompleted(e: InstallVisitCompletedEvent): Promise<void> {
  await completeMilestonesByEvent(e.orgId, e.projectId, "installVisit.completed");
}

// ── Registration ───────────────────────────────────────────
let registered = false;

export function registerMilestoneListeners(): void {
  if (registered) return;
  registered = true;

  bus.subscribe("siteVisit.completed",     onSiteVisitCompleted);
  bus.subscribe("measurement.approved",    onMeasurementApproved);
  bus.subscribe("quotation.accepted",      onQuotationAccepted);
  bus.subscribe("advance.received",        onAdvanceReceived);
  bus.subscribe("grn.received",            onGrnReceived);
  bus.subscribe("allocation.complete",     onAllocationComplete);
  bus.subscribe("makeJob.qcPassed",        onMakeJobQcPassed);
  bus.subscribe("installVisit.completed",  onInstallVisitCompleted);
}
