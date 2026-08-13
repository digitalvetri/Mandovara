import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import {
  getProject, getProjectMilestones, getProjectTasks, getProjectSiteLogs,
} from "@/modules/projects/queries";
import { ProjectStatusPill } from "../_components/StatusPill";
import { ProjectPanels } from "../_components/ProjectPanels";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const p = await getProject(ctx, id);
  if (!p) notFound();

  const [milestones, tasks, siteLogs] = await Promise.all([
    getProjectMilestones(ctx, id),
    getProjectTasks(ctx, id),
    getProjectSiteLogs(ctx, id),
  ]);

  const completedMs = milestones.filter((m) => m.status === "COMPLETED").length;
  const completedBilling = milestones
    .filter((m) => m.status === "COMPLETED")
    .reduce((s, m) => s + Number(m.billingPct), 0);

  return (
    <>
      <Topbar
        title={p.name}
        eyebrow={`${shortNumber(p.number, "P-")} · ${p.clientName} · ${formatDate(p.createdAt)}${p.expectedInstallAt ? ` → ${formatDate(p.expectedInstallAt)}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Stage</div>
              <ProjectStatusPill status={p.stage} />
            </div>
            <div className="text-[11.5px] text-text-dim tabular">
              {completedMs}/{milestones.length} milestones · {completedBilling}% billable
            </div>
          </div>

          <ProjectPanels
            projectId={p.id}
            milestones={milestones}
            tasks={tasks}
            siteLogs={siteLogs}
          />
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Contract</div>
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-text-dim text-[11.5px]">Order value</dt>
                <dd className="font-display text-[22px] font-semibold text-text tabular-nums">{formatINR(p.orderValue)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Party + branch</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Client" v={p.clientName} />
              <Row k="Mobile" v={p.clientMobile} mono />
              <Row k="Created" v={formatDate(p.createdAt)} />
              <Row k="Expected install" v={p.expectedInstallAt ? formatDate(p.expectedInstallAt) : "—"} />
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
