// Card-based project list — replaces the wide multi-column table.
// Each card: number (top-left) · status pill (top-right) · project name
// (bold) · client + city (dim) · progress bar · % complete / order value.

import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ProjectRow } from "@/modules/projects/queries";
import { EmptyState } from "@/components/data/DataTable";

interface Props { rows: ProjectRow[] }

export function ProjectCards({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No projects in this view."
        body="Every project starts from a lead. Convert one in Lead Management to seed the first project."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => <Card key={r.id} r={r} />)}
    </ul>
  );
}

// ── Card ──────────────────────────────────────────────────
function Card({ r }: { r: ProjectRow }) {
  const pct = progressForStage(r.stage);
  const isCancelled = r.stage === "CANCELLED";

  return (
    <li>
      <Link
        href={`/projects/${r.id}` as Route}
        className="block h-full rounded-[14px] border border-rule bg-surface p-4 transition-colors hover:border-gold/40"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="tabular-nums text-[11px] text-text-dim">
            {shortNumber(r.number)}
          </span>
          <StagePill stage={r.stage} />
        </div>

        <div className={`mb-1 line-clamp-2 text-[14.5px] font-semibold ${isCancelled ? "text-text-dim" : "text-text"}`}>
          {r.name}
        </div>
        <div className="mb-3 truncate text-[11.5px] text-text-dim">
          {r.clientName}
        </div>

        {/* Progress */}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${isCancelled ? "bg-text-dim/40" : "bg-solid"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-text-dim tabular-nums">{pct}% complete</span>
          <span className={`tabular-nums text-[13px] font-medium ${isCancelled ? "text-text-dim" : "text-text"}`}>
            {formatINR(r.orderValue)}
          </span>
        </div>
      </Link>
    </li>
  );
}

// ── Status pill (compact) ─────────────────────────────────
function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_TONE[stage] ?? { color: "text-text-dim", bg: "bg-surface-2", label: stage };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const STAGE_TONE: Record<string, { color: string; bg: string; label: string }> = {
  ENQUIRY:      { color: "text-text-dim",     bg: "bg-surface-2",     label: "Enquiry" },
  SITE_VISIT:   { color: "text-info",         bg: "bg-info/12",       label: "Site Visit" },
  MEASUREMENT:  { color: "text-info",         bg: "bg-info/12",       label: "Measure" },
  QUOTATION:    { color: "text-heat",         bg: "bg-heat/12",       label: "Quote" },
  ORDERED:      { color: "text-solid",        bg: "bg-solid/12",      label: "Ordered" },
  PROCUREMENT:  { color: "text-solid",        bg: "bg-solid/12",      label: "Procure" },
  MAKE:         { color: "text-solid",        bg: "bg-solid/12",      label: "Make" },
  INSTALLATION: { color: "text-solid",        bg: "bg-solid/12",      label: "Install" },
  SNAGGING:     { color: "text-fault",        bg: "bg-fault/12",      label: "Snag" },
  COMPLETED:    { color: "text-solid",        bg: "bg-solid/12",      label: "Done" },
  CANCELLED:    { color: "text-fault",        bg: "bg-fault/12",      label: "Cancelled" },
};

// Rough progress mapping — one point per stage completed. Not billing
// weight; that lives on the project detail page's Milestones panel.
const STAGE_ORDER: readonly string[] = [
  "ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION",
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING", "COMPLETED",
];
function progressForStage(stage: string): number {
  if (stage === "CANCELLED") return 0;
  const i = STAGE_ORDER.indexOf(stage);
  if (i < 0) return 0;
  return Math.round(((i + 1) / STAGE_ORDER.length) * 100);
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts[parts.length - 1] ?? n;
}
