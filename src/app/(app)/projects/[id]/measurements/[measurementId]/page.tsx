// §5.2 Measurement detail — /projects/[id]/measurements/[measurementId]
//
// Server component. Fetches the round with items grouped by room and
// each item's live CalcResult. Client components handle the accordion
// state, the add-item form, approve button, and item edit/delete.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getRoundDetail, listRoomsForProject } from "@/modules/measurement/queries";
import { RoundDetailView } from "../_components/RoundDetailView";
import { AttachmentsCard } from "@/components/documents/AttachmentsCard";
import { listAttachments } from "@/modules/documents/queries";

export const dynamic = "force-dynamic";

export default async function MeasurementDetailPage({
  params,
}: { params: Promise<{ id: string; measurementId: string }> }) {
  const { id, measurementId } = await params;
  const ctx = await devContext();
  const round = await getRoundDetail(ctx, measurementId);
  if (!round) notFound();
  // Guard the URL against a round belonging to a different subject —
  // and against a lead-scoped round reached through a project path.
  if (round.subject.kind !== "PROJECT" || round.subject.id !== id) notFound();

  // Rooms list feeds the add-item form dropdown; measurers often
  // capture on-site with a room already picked from the parent screen.
  const rooms = await listRoomsForProject(ctx, id);
  const attachments = await listAttachments(ctx, "PROJECT", id);

  return (
    <>
      <Topbar
        title={`Round ${round.number.split("/").slice(-1)[0] ?? round.number}`}
        eyebrow={`${round.subject.number} · ${round.subject.partyName} · ${round.subject.name}`}
      />

      <div className="pb-4">
        <Link
          href={`/projects/${id}/measurements` as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={12} />
          Back to rounds
        </Link>
      </div>

      <RoundDetailView round={round} rooms={rooms} />

      {/* Photos taken on this round. Filed against the PROJECT rather than
          the round, because that is where they are looked for later — the
          owner asked for measurement photos to "store in the client or
          project page", and a round is a thing you visit once. */}
      <div className="mt-5">
        <AttachmentsCard
          ownerType="PROJECT"
          ownerId={id}
          rows={attachments}
          canEdit={ctx.permissions.has("project.update")}
          title="Photos from site"
          hint="Take or upload a photo while you are measuring — it shows on the project page too."
          defaultCategory="SITE_SHOT"
        />
      </div>
    </>
  );
}
