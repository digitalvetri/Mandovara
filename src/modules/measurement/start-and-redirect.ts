"use server";

// One-click "Start measurement" — combines startMeasurementRound with
// server-side device detection so the client only has to trigger the
// action and follow the redirect.
//
// Behaviours:
//   1. If the project has no rooms → returns { needsRooms: true }.
//      The caller opens the room-setup sheet instead of redirecting.
//   2. Otherwise → creates or resumes a DRAFT round, then throws a
//      Next-router redirect to the device-appropriate route.
//
// Device rule (spec §4): phone/tablet → /m/measure/[projectId];
// desktop → /projects/[id]/measurements/[measurementId].
//
// This lives in its own file (not actions.ts) because Next.js server
// actions can be called from client components only if they don't share
// a module with server-only Prisma types the client bundle can't see.

import { redirect } from "next/navigation";
import type { Route } from "next";
import { isMobileUserAgent } from "@/lib/device";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { generateMilestonesForProject } from "@/kernel/milestones/generate";
import { startMeasurementRound } from "./actions";
import { encodeSubjectParam } from "./subject";

export interface StartAndRedirectInput {
  /** Exactly one of projectId / leadId — leads are measurable since 2026-08-27. */
  projectId?: string;
  leadId?:    string;
  /**
   * The visit this measurement is being taken on. Stamped onto the round
   * so "which trip produced these dimensions" is answerable from the
   * data. `Measurement.siteVisitId` has existed since the schema was
   * written and nothing had ever populated it — which is exactly why
   * site visits and measurements read as two unrelated modules.
   */
  siteVisitId?: string;
}

export interface StartAndRedirectResult {
  ok: true;
  needsRooms: true;
}

export async function startMeasurementAndRedirect(
  input: StartAndRedirectInput,
): Promise<StartAndRedirectResult> {
  const res = await startMeasurementRound({
    ...(input.projectId ? { projectId: input.projectId } : { leadId: input.leadId }),
    visitedAt: new Date(),
    ...(input.siteVisitId ? { siteVisitId: input.siteVisitId } : {}),
  });

  if (!res.ok) {
    // The action already produced a helpful message; rethrow as a
    // recognisable Error so the client boundary shows it.
    throw new Error(res.error);
  }

  if (res.needsRooms) {
    // Client is expected to open the room-setup sheet, then re-invoke
    // this action after adding at least one room.
    return { ok: true, needsRooms: true };
  }

  const subject = input.projectId
    ? ({ kind: "PROJECT", id: input.projectId } as const)
    : ({ kind: "LEAD",    id: input.leadId ?? "" } as const);

  const mobile = await isMobileUserAgent();
  const target: Route = mobile
    ? (`/m/measure/${encodeSubjectParam(subject)}` as Route)
    : (`${subject.kind === "PROJECT" ? "/projects" : "/leads"}/${subject.id}/measurements/${res.data.id}` as Route);

  redirect(target);
}

// ── Stub project for measurement-first workflow (2026-08-26) ───────────
//
// Owner ask: capture a measurement directly from the Client 360, without
// forcing the operator to bounce through /projects/new first. This
// creates a minimal Project so the measurement pipeline has something to
// attach to. Once the operator returns to fill in real project details
// (site address, order value, etc.) they edit this row rather than
// creating a new one.
//
// SCOPE NARROWED 2026-08-27. This used to cover two cases: an unconverted
// LEAD, and a CLIENT with no project yet. Leads no longer need it —
// Measurement and Room now carry a leadId, so a prospect's site is
// measured directly and convertLead reparents the rows. The remaining
// case is the second one, and it still needs this: a Client is neither a
// project nor a lead, so there is nothing for a round to hang off until
// a Project exists. Do not delete this while /clients can start a
// measurement.
export interface CreateStubProjectResult {
  ok: true;
  data: { projectId: string };
}

export interface CreateStubProjectError {
  ok: false;
  error: string;
}

export async function createStubProjectForClient(input: {
  clientId: string;
}): Promise<CreateStubProjectResult | CreateStubProjectError> {
  const ctx = await devContext();
  requirePermission(ctx, "project.create");

  const db = scoped(ctx);
  const client = await db.client.findUnique({
    where:  { id: input.clientId },
    select: { id: true, name: true },
  });
  if (!client) return { ok: false, error: "Client not found" };

  // Same branch-lookup shape as convertLead — first branch on the org.
  const branch = await db.branch.findFirst({
    select: { id: true, invoicePrefix: true },
  });
  if (!branch) {
    return { ok: false, error: "No branch is configured — add one in Settings before starting a measurement." };
  }

  const yymm = yymmFromDate(new Date());
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "PRJ",
      yymm,
      prefix: branch.invoicePrefix,
    });
    const project = await tx.project.create({
      data: {
        organizationId: ctx.orgId,
        branchId:       branch.id,
        number,
        name:           client.name,
        clientId:       client.id,
        stage:          "ENQUIRY",
        siteAddress:    {},
        ownerId:        ctx.userId,
      },
      select: { id: true },
    });
    await generateMilestonesForProject(tx, {
      orgId:     ctx.orgId,
      projectId: project.id,
      families:  [],
    });
    return project;
  }, { orgId: ctx.orgId });

  return { ok: true, data: { projectId: created.id } };
}
