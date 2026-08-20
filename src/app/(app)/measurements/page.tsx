// Top-level Measurements page — cross-project rounds view.

import Link from "next/link";
import type { Route } from "next";
import { Ruler, Calendar, User, Hash } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listOrgRounds } from "@/modules/measurement/org-queries";
import type { MeasurementStatusStr } from "@/modules/measurement/queries-types";
import { listProjectsForSelect } from "@/modules/projects/queries";
import { NewMeasurementSheet } from "./_components/NewMeasurementSheet";

export const dynamic = "force-dynamic";

// Superseded is an internal archival state — not useful for field staff.
const FILTER_STATUSES: readonly MeasurementStatusStr[] = ["DRAFT", "SUBMITTED", "APPROVED"];

const STATUS_STRIP: Record<string, string> = {
  DRAFT:      "bg-info",
  SUBMITTED:  "bg-heat",
  APPROVED:   "bg-solid",
  SUPERSEDED: "bg-border",
};

const STATUS_CHIP: Record<string, string> = {
  DRAFT:      "bg-info/12 text-info",
  SUBMITTED:  "bg-heat/12 text-heat",
  APPROVED:   "bg-solid/12 text-solid",
  SUPERSEDED: "bg-surface-2 text-text-dim",
};

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}

export default async function MeasurementsIndexPage({ searchParams }: PageProps) {
  const sp     = await searchParams;
  const status = (FILTER_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as MeasurementStatusStr)
    : undefined;
  const search = sp.search?.trim() || undefined;
  const page   = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const ctx = await devContext();
  const [{ rows, hasNext, totalCounts }, projects] = await Promise.all([
    listOrgRounds(ctx, { ...(status && { status }), ...(search && { search }), page }),
    listProjectsForSelect(ctx),
  ]);

  const totalActive = totalCounts.DRAFT + totalCounts.SUBMITTED + totalCounts.APPROVED;

  return (
    <>
      <Topbar
        title="Measurements"
        eyebrow={`${totalActive.toLocaleString("en-IN")} active rounds across the studio`}
        actions={<NewMeasurementSheet projects={projects} />}
      />

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2 pb-5">
        <FilterChip label="All" href="/measurements" active={!status} count={totalActive} />
        {FILTER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0) + s.slice(1).toLowerCase()}
            href={`/measurements?status=${s}` as Route}
            active={status === s}
            count={totalCounts[s]}
          />
        ))}
        <form action="/measurements" method="GET" className="w-full sm:w-auto sm:ml-auto min-w-0">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Round number, project, client…"
            className="h-[34px] w-full sm:w-[260px] rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors"
          />
        </form>
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <EmptyRounds status={status ?? null} search={search ?? null} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/projects/${r.project.id}/measurements/${r.id}` as Route}
                className="group flex overflow-hidden rounded-[12px] border border-rule bg-surface hover:border-accent/50 hover:shadow-sm transition-all duration-150"
              >
                {/* Status accent strip */}
                <div className={`w-[5px] shrink-0 ${STATUS_STRIP[r.status] ?? "bg-border"}`} />

                {/* Main content */}
                <div className="flex flex-1 items-center gap-4 px-5 py-4 min-w-0">

                  {/* Round number */}
                  <div className="shrink-0 w-[110px]">
                    <div className="tabular text-[13px] font-semibold text-accent group-hover:text-accent">
                      {shortNumber(r.number)}
                    </div>
                    <div className="text-[10.5px] text-text-faint tabular mt-0.5">v{r.revision}</div>
                  </div>

                  {/* Project + client */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-text truncate group-hover:text-accent transition-colors">
                      {r.project.name}
                    </div>
                    <div className="text-[11.5px] text-text-dim truncate mt-0.5">
                      {r.project.clientName}
                    </div>
                  </div>

                  {/* Meta: date + measurer */}
                  <div className="shrink-0 hidden md:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
                      <Calendar size={11} strokeWidth={1.75} />
                      <span className="tabular">{formatDate(r.visitedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
                      <User size={11} strokeWidth={1.75} />
                      <span>{r.measuredByName}</span>
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="shrink-0 hidden sm:flex flex-col items-center gap-1 w-[56px]">
                    <div className="flex items-center gap-1 text-[11px] text-text-dim">
                      <Ruler size={10} strokeWidth={1.75} />
                      <span className="tabular font-medium text-text">{r.itemCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-text-faint">
                      <Hash size={9} strokeWidth={1.75} />
                      <span className="tabular">{r.roomCount} rooms</span>
                    </div>
                  </div>

                  {/* Status pill */}
                  <div className="shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${STATUS_CHIP[r.status] ?? "bg-surface-2 text-text-dim"}`}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between pt-5 text-[12px] text-text-dim">
          <span>Page {page}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageHref(page - 1, status, search)}
                className="rounded-[6px] border border-rule px-3 py-1.5 text-text hover:border-accent hover:text-accent transition-colors"
              >
                ← Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildPageHref(page + 1, status, search)}
                className="rounded-[6px] border border-rule px-3 py-1.5 text-text hover:border-accent hover:text-accent transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function FilterChip({ label, href, active, count }: {
  label: string; href: string; active: boolean; count: number;
}) {
  return (
    <Link
      href={href as Route}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
        active
          ? "border border-accent bg-accent/8 text-accent font-medium"
          : "border border-rule text-text-dim hover:text-text hover:border-text-dim"
      }`}
    >
      <span>{label}</span>
      <span className="tabular text-[10.5px] opacity-70">{count.toLocaleString("en-IN")}</span>
    </Link>
  );
}

function EmptyRounds({ status, search }: { status: MeasurementStatusStr | null; search: string | null }) {
  const msg = search
    ? `No rounds match "${search}".`
    : status
      ? `No ${status.toLowerCase()} rounds right now.`
      : "No measurement rounds yet.";
  return (
    <div className="rounded-[12px] border border-rule bg-surface px-6 py-14 text-center">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
        <Ruler size={18} strokeWidth={1.5} className="text-text-dim" />
      </div>
      <div className="text-[14px] font-medium text-text mb-1">{msg}</div>
      <div className="text-[12px] text-text-dim">
        Start a round from a project page, or use the <strong>New measurement</strong> button above.
      </div>
    </div>
  );
}

function buildPageHref(page: number, status?: MeasurementStatusStr, search?: string): Route {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", String(page));
  return `/measurements?${params.toString()}` as Route;
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? (parts.slice(-1)[0] ?? n) : n;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
  }).format(d);
}
