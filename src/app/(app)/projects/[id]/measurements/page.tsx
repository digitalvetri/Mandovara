// §5.1 Measurement rounds list — /projects/[id]/measurements
//
// Columns: number · visit date · measured by · status pill · item count
// · rooms covered · revision.  Superseded rounds collapse UNDER their
// replacement rather than disappearing — a user must always be able to
// see the prior dimensions and who changed them.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getProject } from "@/modules/projects/queries";
import { listRoundsForProject } from "@/modules/measurement/queries";
import { RoundsList } from "./_components/RoundsList";
import { NewRoundButton } from "./_components/NewRoundButton";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const project = await getProject(ctx, id);
  if (!project) notFound();
  const groups = await listRoundsForProject(ctx, project.id);

  return (
    <>
      <Topbar
        title="Measurements"
        eyebrow={`${project.number} · ${project.clientName} · ${project.name}`}
      />

      <div className="flex items-center justify-between pb-4">
        <Link
          href={`/projects/${project.id}` as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={12} />
          Back to project
        </Link>
        <NewRoundButton projectId={project.id} />
      </div>

      <RoundsList projectId={project.id} groups={groups} />
    </>
  );
}
