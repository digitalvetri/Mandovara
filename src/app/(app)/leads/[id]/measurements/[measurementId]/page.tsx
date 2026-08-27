// Measurement round detail for a LEAD — the mirror of
// /projects/[id]/measurements/[measurementId].
//
// Renders the identical RoundDetailView; the only difference is which
// parent the breadcrumb and the room list resolve against. Leads became
// measurable on 2026-08-27 so a prospect's site can be measured without
// first committing them to a Client record.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getRoundDetail, listRoomsForSubject } from "@/modules/measurement/queries";
import { RoundDetailView } from "../../../../projects/[id]/measurements/_components/RoundDetailView";

export const dynamic = "force-dynamic";

export default async function LeadMeasurementDetailPage({
  params,
}: { params: Promise<{ id: string; measurementId: string }> }) {
  const { id, measurementId } = await params;
  const ctx = await devContext();
  const round = await getRoundDetail(ctx, measurementId);
  if (!round) notFound();
  // Guard the URL: a project-scoped round must not be reachable through
  // a lead path, and one lead's round must not open under another's.
  if (round.subject.kind !== "LEAD" || round.subject.id !== id) notFound();

  const rooms = await listRoomsForSubject(ctx, { kind: "LEAD", id });

  return (
    <>
      <Topbar
        title={`Round ${round.number.split("/").slice(-1)[0] ?? round.number}`}
        eyebrow={`${round.subject.number} · ${round.subject.name} · not yet a client`}
      />

      <div className="pb-4">
        <Link
          href={`/leads/${id}` as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={12} />
          Back to lead
        </Link>
      </div>

      <RoundDetailView round={round} rooms={rooms} />
    </>
  );
}
