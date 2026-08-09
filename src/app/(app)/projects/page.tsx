import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listProjects } from "@/modules/projects/queries";
import { PROJECT_STAGES as PROJECT_STATUSES, type ProjectStage as ProjectStatus } from "@/modules/projects/schema";
import { ProjectFilters } from "./_components/ProjectFilters";
import { ProjectsTable } from "./_components/ProjectsTable";

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

  const { rows, total, pageSize } = await listProjects(ctx, {
    ...(q != null && { search: q }), stage, page,
  });

  return (
    <>
      <Topbar
        title="Project Pipeline"
        eyebrow={`${total} project${total === 1 ? "" : "s"} · ${eyebrowFor(stage, q)}`}
        actions={
          <Link href={"/projects/new" as Route}>
            <PrimaryButton>New Project</PrimaryButton>
          </Link>
        }
      />
      <ProjectFilters />
      <ProjectsTable rows={rows} />
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
function eyebrowFor(status: string, q: string | undefined): string {
  const bits: string[] = [];
  bits.push(status === "ACTIVE" ? "active" : status === "ALL" ? "all stages" : status.toLowerCase().replace(/_/g, " "));
  if (q) bits.push(`matching "${q}"`);
  return bits.join(" · ");
}
