// §5.3 Field capture PWA — /m/measure/[projectId]
//
// Server component. Resolves the project, rooms and the caller's
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
import { getProject } from "@/modules/projects/queries";
import { listRoomsForProject, findResumableRound } from "@/modules/measurement/queries";
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
  const project = await getProject(ctx, projectId);
  if (!project) notFound();

  const rooms  = await listRoomsForProject(ctx, projectId);
  const resume = await findResumableRound(ctx, projectId);

  return (
    <FieldShell
      project={{
        id:         project.id,
        number:     project.number,
        name:       project.name,
        clientName: project.clientName,
      }}
      rooms={rooms}
      resumableRound={resume}
    />
  );
}
