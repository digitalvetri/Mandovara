// Projects landing page — redesigned per the reference screenshot.
//   ┌ Projects · N shown             + New Project
//   ├ 4 KPI tiles (Active · Awaiting measure · Payments overdue · Receivables)
//   ├ pill filters (All / Active / Completed / Cancelled)
//   ├ search pill
//   └ card grid — one card per project, progress bar + order value

import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { getProjectKpis, listProjects } from "@/modules/projects/queries";
import { PROJECT_STAGES as PROJECT_STATUSES, type ProjectStage as ProjectStatus } from "@/modules/projects/schema";
import { ProjectKpiCards } from "./_components/ProjectKpiCards";
import { ProjectsToolbar } from "./_components/ProjectsToolbar";
import { ProjectCards } from "./_components/ProjectCards";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; stage?: string; status?: string; page?: string; }

export default async function ProjectsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const stage = normaliseStatus(params.stage ?? params.status);
  const page = parsePositiveInt(params.page) ?? 1;

  const [{ rows, total, pageSize }, kpis] = await Promise.all([
    listProjects(ctx, { ...(q != null && { search: q }), stage, page }),
    getProjectKpis(ctx),
  ]);

  return (
    <>
      <Topbar title="" />

      {/* Header */}
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-none text-text">Projects</h1>
          <div className="mt-1 text-[11.5px] text-text-dim tabular-nums">
            {total} shown
          </div>
        </div>
        <Link
          href={"/projects/new" as Route}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-gold-strong"
        >
          <Plus size={13} strokeWidth={2.4} />
          New Project
        </Link>
      </div>

      <ProjectKpiCards kpis={kpis} />
      <ProjectsToolbar />
      <ProjectCards rows={rows} canEditStage={ctx.permissions.has("project.update")} />
      <Pager page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function normaliseStatus(v: string | undefined): ProjectStatus | "ACTIVE" | "ALL" {
  if (v == null || v === "" || v === "OPEN") return "ALL";
  if (v === "ACTIVE" || v === "ALL") return v;
  if ((PROJECT_STATUSES as readonly string[]).includes(v)) return v as ProjectStatus;
  return "ALL";
}
function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
