// §5.3 Field capture PWA — /m/measure/[subject]
//
// The route segment is still named [projectId] for continuity: every
// existing link, bookmark and queued offline item keeps working, because
// a bare cuid still means a project. A "lead-" prefix means a lead
// (2026-08-27) — decodeSubjectParam is the whole difference, and the
// twelve components below this page never learn which they got.
//
// Server component. Resolves the subject, rooms and the caller's
// most-recent DRAFT round (if any) so the PWA can resume mid-visit
// without starting over. The client shell (FieldCapture) drives the
// actual one-item-per-screen flow.
//
// If no resumable round exists, the client shows the "Ready to
// measure" starter card with a single big button — that pattern
// avoids surprising a measurer with a phantom round they didn't
// intend to start.

import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getProject } from "@/modules/projects/queries";
import { listRoomsForSubject, findResumableRound } from "@/modules/measurement/queries";
import { decodeSubjectParam } from "@/modules/measurement/subject";
import type { FieldSubject } from "./_components/types";
import { FieldShell } from "./_components/FieldShell";

export const dynamic = "force-dynamic";

// Field PWA renders its own chrome — no app sidebar, no topbar.
export const viewport = {
  themeColor: "#0F2A28",
  width:      "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function FieldMeasurePage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await devContext();
  const ref = decodeSubjectParam(projectId);

  let subject: FieldSubject;
  if (ref.kind === "PROJECT") {
    const project = await getProject(ctx, ref.id);
    if (!project) notFound();
    subject = {
      kind: "PROJECT", id: project.id, number: project.number,
      name: project.name, clientName: project.clientName,
    };
  } else {
    const lead = await scoped(ctx).lead.findUnique({
      where: { id: ref.id }, select: { id: true, number: true, name: true },
    });
    if (!lead) notFound();
    subject = {
      kind: "LEAD", id: lead.id, number: lead.number,
      name: lead.name, clientName: "Lead — not yet a client",
    };
  }

  const rooms  = await listRoomsForSubject(ctx, ref);
  const resume = await findResumableRound(ctx, ref);

  return <FieldShell subject={subject} rooms={rooms} resumableRound={resume} />;
}
