import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { getProject } from "@/modules/projects/queries";
import { listMeasurementsForProject } from "@/modules/measurement/queries";
import { shortNumber } from "@/lib/short-number";
import { MeasurementBuilder } from "./_components/MeasurementBuilder";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const p = await getProject(ctx, id);
  if (!p) notFound();
  const initial = await listMeasurementsForProject(ctx, p.id);

  return (
    <>
      <Topbar
        title="Measurements"
        eyebrow={`${shortNumber(p.number, "P-")} · ${p.clientName} · ${p.name} · Type dimensions on site; the engine runs live and warnings render as you go.`}
      />

      <div className="pb-3">
        <Link
          href={`/projects/${p.id}` as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={12} />
          Back to project
        </Link>
      </div>

      <MeasurementBuilder projectId={p.id} initial={initial} />
    </>
  );
}
