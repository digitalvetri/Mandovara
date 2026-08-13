// Top-level Measurements page — cross-project rounds view.
// Sidebar entry point for measurers and designers who work across
// several projects and want a single stream of rounds to open.

import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { listOrgRounds } from "@/modules/measurement/org-queries";
import type { MeasurementStatusStr } from "@/modules/measurement/queries-types";
import { StatusPill } from "../projects/[id]/measurements/_components/StatusPill";

export const dynamic = "force-dynamic";

const STATUSES: readonly MeasurementStatusStr[] = ["DRAFT", "SUBMITTED", "APPROVED", "SUPERSEDED"];

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}

export default async function MeasurementsIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as MeasurementStatusStr) ? (sp.status as MeasurementStatusStr) : undefined;
  const search = sp.search?.trim() || undefined;
  const page   = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const ctx = await devContext();
  const { rows, hasNext, totalCounts } = await listOrgRounds(ctx, {
    ...(status && { status }),
    ...(search && { search }),
    page,
  });

  const totalActive = totalCounts.DRAFT + totalCounts.SUBMITTED + totalCounts.APPROVED;

  return (
    <>
      <Topbar
        title="Measurements"
        eyebrow={`${totalActive.toLocaleString("en-IN")} active rounds across the studio`}
      />

      <div className="flex items-center gap-2 pb-4">
        <FilterChip label="All"        href="/measurements"                      active={!status} count={totalActive} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0) + s.slice(1).toLowerCase()}
            href={`/measurements?status=${s}` as Route}
            active={status === s}
            count={totalCounts[s]}
          />
        ))}
        <form action="/measurements" method="GET" className="ml-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Round number, project, client..."
            className="h-[32px] w-[280px] rounded-[6px] border border-rule bg-transparent px-2 text-[12px] text-text placeholder:text-text-faint"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyRounds status={status ?? null} search={search ?? null} />
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-rule bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Round</th>
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">Client</th>
                <th className="px-3 py-2 text-left font-medium">Visited</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="px-3 py-2 text-right font-medium">Rooms</th>
                <th className="px-3 py-2 text-right font-medium">Rev</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-rule hover:bg-surface-hover">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/projects/${r.project.id}/measurements/${r.id}` as Route}
                      className="tabular font-medium text-text hover:text-gold"
                    >
                      {shortNumber(r.number)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-text-dim">{r.project.name}</td>
                  <td className="px-3 py-2.5 text-text-dim">{r.project.clientName}</td>
                  <td className="px-3 py-2.5 tabular text-text-dim">{formatDate(r.visitedAt)}</td>
                  <td className="px-3 py-2.5 text-text-dim">{r.measuredByName}</td>
                  <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2.5 text-right tabular">{r.itemCount}</td>
                  <td className="px-3 py-2.5 text-right tabular">{r.roomCount}</td>
                  <td className="px-3 py-2.5 text-right tabular text-text-dim">v{r.revision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between pt-4 text-[11.5px] text-text-dim">
          <div>Page {page}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageHref(page - 1, status, search)}
                className="rounded-[4px] border border-rule px-2.5 py-1 text-text hover:border-gold hover:text-gold"
              >
                ← Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildPageHref(page + 1, status, search)}
                className="rounded-[4px] border border-rule px-2.5 py-1 text-text hover:border-gold hover:text-gold"
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

function FilterChip({
  label, href, active, count,
}: { label: string; href: string; active: boolean; count: number }) {
  return (
    <Link
      href={href as Route}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
        active
          ? "border border-gold bg-gold-tint text-gold-strong"
          : "border border-rule bg-transparent text-text-dim hover:text-text"
      }`}
    >
      <span>{label}</span>
      <span className="tabular text-[10.5px] opacity-80">{count.toLocaleString("en-IN")}</span>
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
    <div className="rounded-[10px] border border-rule bg-surface px-6 py-10 text-center">
      <div className="text-[13px] text-text mb-1">{msg}</div>
      <div className="text-[11.5px] text-text-dim">
        Rounds start on the project — open a project and hit “New measurement round”.
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
  return parts.length >= 2 ? parts.slice(-1)[0] ?? n : n;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(d);
}
