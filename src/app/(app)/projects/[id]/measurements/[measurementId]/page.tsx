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

export const dynamic = "force-dynamic";

export default async function MeasurementDetailPage({
  params,
}: { params: Promise<{ id: string; measurementId: string }> }) {
  const { id, measurementId } = await params;
  const ctx = await devContext();
  const round = await getRoundDetail(ctx, measurementId);
  if (!round) notFound();
  if (round.project.id !== id) notFound();

  // Rooms list feeds the add-item form dropdown; measurers often
  // capture on-site with a room already picked from the parent screen.
  const rooms = await listRoomsForProject(ctx, id);

  return (
    <>
      <Topbar
        title={`Round ${round.number.split("/").slice(-1)[0] ?? round.number}`}
        eyebrow={`${round.project.number} · ${round.project.clientName} · ${round.project.name}`}
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
    </>
  );
}
