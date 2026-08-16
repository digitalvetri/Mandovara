// Project detail — redesigned per docs/BUILD-SPEC.md project-detail.
//
// Layout (§1):
//   ┌ header: project number · name · stage stepper · figures
//   │
//   ├ 2-col grid
//   │   left  : Next Action · Milestones · Measurements · Quote/Order · Collapsed tasks + logs
//   │   right : Client · Site · Money (permission-gated) · Team  (sticky)
//
// Data (§7 — money block gate): getProjectMoney() returns null when the
// user's permissions don't cover margin/outstanding, so the row IDs and
// paisa values never leave the DB for those roles.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { shortNumber } from "@/lib/short-number";
import { devContext } from "@/lib/dev-context";
import {
  getProject, getProjectMilestones, getProjectTasks,
  getProjectMeasurements, getProjectMoney,
  getProjectPayments, getProjectChosenItems,
} from "@/modules/projects/queries";
import { listSiteVisits } from "@/modules/site-visits/queries";
import { resolveNextAction } from "@/modules/projects/next-action";
import { StageStepper } from "../_components/StageStepper";
import { MilestonesPanel } from "../_components/MilestonesPanel";
import { MeasurementsSection } from "../_components/MeasurementsSection";
import { RightRail } from "../_components/RightRail";
import { CollapsedPanels } from "../_components/CollapsedPanels";
import { StartMeasurementFlow } from "../_components/StartMeasurementFlow";
import { UpcomingVisitsCard } from "../_components/UpcomingVisitsCard";
import { PaymentsPanel } from "../_components/PaymentsPanel";
import { ChosenItemsPanel } from "../_components/ChosenItemsPanel";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const p = await getProject(ctx, id);
  if (!p) notFound();

  const [milestones, tasks, rounds, money, visits, payments, chosen] = await Promise.all([
    getProjectMilestones(ctx, id),
    getProjectTasks(ctx, id),
    getProjectMeasurements(ctx, id),
    getProjectMoney(ctx, id),
    listSiteVisits(ctx, { projectId: id, limit: 10 }),
    getProjectPayments(ctx, id),
    getProjectChosenItems(ctx, id),
  ]);

  const action = resolveNextAction(ctx, { id: p.id, stage: p.stage });
  const receivedTotal = money?.receiptTotal ?? 0n;
  const pctCompleteHeader = milestones.length > 0
    ? Math.round(
        (milestones.filter((m) => m.status === "COMPLETED").length /
         milestones.length) * 100,
      )
    : 0;

  return (
    <>
      <Topbar
        title=""
        eyebrow=""
        actions={
          <Link
            href={`/products?forProject=${encodeURIComponent(p.id)}` as Route}
            className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] border border-rule bg-surface text-[12px] text-text-dim hover:text-text hover:border-gold/40 transition-colors"
          >
            <Package size={13} strokeWidth={2} />
            Browse catalog
          </Link>
        }
      />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-[14px] border border-rule bg-surface p-6">
        <div className="mb-1 flex items-baseline gap-3 text-[11px] uppercase tracking-[0.14em] text-text-dim">
          <span className="tabular-nums">{shortNumber(p.number, "P-")}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(p.createdAt)}</span>
        </div>

        <h1 className="font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.015em] text-text">
          {p.name}
        </h1>

        <div className="mt-4">
          <StageStepper
            stage={p.stage}
            projectId={p.id}
            canEdit={ctx.permissions.has("project.update")}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[12.5px] tabular-nums text-text-dim">
          <HeaderStat k="Order value" v={formatINR(p.orderValue)} />
          {money && <HeaderStat k="Received" v={formatINR(receivedTotal)} />}
          <HeaderStat k="Progress" v={`${pctCompleteHeader}%`} />
        </div>
      </div>

      {/* ── Body — 2-column grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 pb-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <StartMeasurementFlow projectId={p.id} action={action} currentUserId={ctx.userId} />
          <UpcomingVisitsCard visits={visits} />
          <MilestonesPanel milestones={milestones} orderValue={p.orderValue} />
          <ChosenItemsPanel projectId={p.id} items={chosen} />
          <MeasurementsSection projectId={p.id} rounds={rounds} />
          {payments && (
            <PaymentsPanel
              payments={payments}
              canCreate={ctx.permissions.has("invoice.create")}
            />
          )}
          <CollapsedPanels projectId={p.id} tasks={tasks} />
        </div>

        <RightRail project={p} money={money} />
      </div>
    </>
  );
}

function HeaderStat({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">{k}</span>
      <span className="text-text">{v}</span>
    </span>
  );
}
