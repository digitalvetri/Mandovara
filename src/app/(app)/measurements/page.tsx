// Top-level Measurements page — cross-project rounds view.

import Link from "next/link";
import type { Route } from "next";
import { Ruler } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listOrgRounds } from "@/modules/measurement/org-queries";
import { roundHref } from "@/modules/measurement/subject";
import type { MeasurementStatusStr } from "@/modules/measurement/queries-types";
import { listProjectsForSelect } from "@/modules/projects/queries";
import { NewMeasurementSheet } from "./_components/NewMeasurementSheet";
import { FieldworkTabs } from "@/components/layout/FieldworkTabs";

export const dynamic = "force-dynamic";

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
        title="Site Visits & Measurements"
        eyebrow={`${totalActive.toLocaleString("en-IN")} active rounds across the studio`}
        actions={<NewMeasurementSheet projects={projects} />}
      />

      <FieldworkTabs />

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

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyRounds status={status ?? null} search={search ?? null} />
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-rule bg-surface">
          <table className="w-full border-collapse">
            {/* Column headers */}
            <thead>
              <tr className="bg-surface-2 border-b border-rule">
                <th className="w-[5px] p-0" aria-hidden />
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Round</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Project</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">Visited</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">By</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Status</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Items</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">Rooms</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">Rev</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={[
                    "group relative transition-colors hover:bg-surface-2/60",
                    i > 0 ? "border-t border-rule" : "",
                  ].join(" ")}
                >
                  {/* Coloured accent strip */}
                  <td className="p-0 w-[5px]">
                    <div className={`h-full w-[5px] min-h-[60px] ${STATUS_STRIP[r.status] ?? "bg-border"}`} />
                  </td>

                  {/* Round number */}
                  <td className="px-4 py-4">
                    <Link
                      href={roundHref(r.subject, r.id) as Route}
                      className="block tabular text-[13.5px] font-semibold text-accent hover:underline"
                    >
                      {shortNumber(r.number)}
                    </Link>
                    <div className="tabular text-[10.5px] text-text-faint mt-0.5">v{r.revision}</div>
                  </td>

                  {/* Project or lead — a round no longer implies a project */}
                  <td className="px-4 py-4 max-w-[200px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-medium text-text truncate">{r.subject.name}</span>
                      {r.subject.kind === "LEAD" && (
                        <span className="shrink-0 text-[9.5px] font-medium uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[3px] bg-heat/12 text-heat">
                          Lead
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-dim mt-0.5 truncate md:hidden">{r.subject.partyName}</div>
                  </td>

                  {/* Client */}
                  <td className="px-4 py-4 text-[12.5px] text-text-dim hidden md:table-cell max-w-[160px]">
                    <span className="truncate block">{r.subject.partyName}</span>
                  </td>

                  {/* Visited */}
                  <td className="px-4 py-4 tabular text-[12.5px] text-text-dim hidden lg:table-cell whitespace-nowrap">
                    {formatDate(r.visitedAt)}
                  </td>

                  {/* By */}
                  <td className="px-4 py-4 text-[12.5px] text-text-dim hidden lg:table-cell max-w-[140px]">
                    <span className="truncate block">{r.measuredByName}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${STATUS_CHIP[r.status] ?? "bg-surface-2 text-text-dim"}`}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </span>
                  </td>

                  {/* Items */}
                  <td className="px-4 py-4 text-right tabular text-[13px] font-medium text-text hidden sm:table-cell">
                    {r.itemCount}
                  </td>

                  {/* Rooms */}
                  <td className="px-4 py-4 text-right tabular text-[13px] text-text-dim hidden sm:table-cell">
                    {r.roomCount}
                  </td>

                  {/* Rev */}
                  <td className="px-4 py-4 text-right tabular text-[12px] text-text-faint">
                    v{r.revision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
