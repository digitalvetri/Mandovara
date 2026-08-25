// Milestones panel — grouped by family when the project has more than one,
// otherwise a flat list. Each row shows: name, family swatch, an "auto"
// chip on autoCompleted rows, and a status pill.
//
// Top of the panel: single progress bar showing % complete by billing
// weight (not row count) plus ₹ value earned to date if orderValue > 0.
// Replaces the "1/1 milestones · 25% billable" line the spec flags as
// unexplained (spec §0).

import { formatINR } from "@/kernel/money/format";
import type { ProjectMilestone } from "@/modules/projects/queries";

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC: "Curtains",
  SHEER:          "Sheer",
  WALLPAPER:      "Wallpaper",
  FLOORING:       "Flooring",
  CARPET_ROLL:    "Carpet",
  CARPET_TILE:    "Carpet tiles",
  RUG:            "Rugs",
  BLIND:          "Blinds",
  UPHOLSTERY_FABRIC: "Upholstery",
  VERTICAL_GARDEN:   "Vertical garden",
  INTERIOR_FILM:     "Interior film",
  MURAL:             "Mural",
};

interface Props {
  milestones: ProjectMilestone[];
  orderValue: bigint;
}

export function MilestonesPanel({ milestones: raw, orderValue }: Props) {
  const milestones = dedupeByCode(raw);
  // Owner asked (2026-08-25) for the empty-state box to disappear —
  // the "will be auto-generated" note is noise on new projects. Only
  // render the panel when there are actual milestones to show.
  if (milestones.length === 0) return null;

  const totalWeight = milestones.reduce((s, m) => s + weight(m), 0);
  const completedWeight = milestones
    .filter((m) => m.status === "COMPLETED")
    .reduce((s, m) => s + weight(m), 0);
  const pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const earned = orderValue > 0n && totalWeight > 0
    ? (orderValue * BigInt(Math.round(completedWeight * 100))) /
      BigInt(Math.round(totalWeight * 100))
    : 0n;

  const families = Array.from(new Set(milestones.map((m) => m.family).filter(Boolean))) as string[];
  const grouped = families.length > 1;

  return (
    <Section
      title="Milestones"
      right={
        <span className="text-[11px] tabular-nums text-text-dim">
          {pct}% complete
          {orderValue > 0n && (
            <>
              <span className="mx-2 text-text-subtle">·</span>
              {formatINR(earned)} earned
            </>
          )}
        </span>
      }
    >
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-solid transition-[width] duration-[240ms] ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>

      {grouped ? (
        <div className="space-y-4">
          {families.map((f) => (
            <FamilyGroup
              key={f}
              family={f}
              milestones={milestones.filter((m) => m.family === f)}
            />
          ))}
          {milestones.some((m) => !m.family) && (
            <FamilyGroup family={null} milestones={milestones.filter((m) => !m.family)} />
          )}
        </div>
      ) : (
        <ul className="space-y-1">
          {milestones.map((m) => <MilestoneRow key={m.id} m={m} />)}
        </ul>
      )}
    </Section>
  );
}

function weight(m: ProjectMilestone): number {
  const w = m.billingWeightPct ?? m.billingPct;
  return Number(w) || 0;
}

// Auto-generation runs one milestone per (project × active family), which
// makes "Site visit", "Measurement", "Handover" etc. appear once per
// family a project spans. That's noise: those gates fire once for the
// project as a whole. Collapse by code, preferring the completed row so
// the list stays honest when part of the fleet is done.
function dedupeByCode(list: ProjectMilestone[]): ProjectMilestone[] {
  const byCode = new Map<string, ProjectMilestone>();
  for (const m of list) {
    const key = m.templateCode ?? `${m.family ?? ""}::${m.name}::${m.order}`;
    const existing = byCode.get(key);
    if (!existing) { byCode.set(key, m); continue; }
    const rank = (x: ProjectMilestone) => x.status === "COMPLETED" ? 3 : x.status === "IN_PROGRESS" ? 2 : x.status === "BLOCKED" ? 1 : 0;
    if (rank(m) > rank(existing)) byCode.set(key, m);
  }
  return Array.from(byCode.values()).sort((a, b) => a.order - b.order);
}

function FamilyGroup({ family, milestones }: { family: string | null; milestones: ProjectMilestone[] }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        {family && <span aria-hidden className="h-2 w-2 rounded-[2px] bg-gold-tint" />}
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
          {family ? (FAMILY_LABEL[family] ?? family) : "Common"}
        </span>
      </div>
      <ul className="space-y-1">
        {milestones.map((m) => <MilestoneRow key={m.id} m={m} />)}
      </ul>
    </div>
  );
}

function MilestoneRow({ m }: { m: ProjectMilestone }) {
  const done = m.status === "COMPLETED";
  return (
    <li
      className={[
        "flex items-center gap-3 rounded-[8px] px-3 py-2 text-[12.5px]",
        done ? "bg-surface-2/40" : "hover:bg-surface-2/30",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          done ? "bg-solid" : "border border-rule",
        ].join(" ")}
      />
      <span className="text-text">{m.name}</span>
      {m.autoCompleted && (
        <span className="rounded-[3px] border border-rule px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em] text-text-dim">
          auto
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        {weight(m) > 0 && (
          <span className="text-[10.5px] tabular-nums text-text-dim">{weight(m).toFixed(1)}%</span>
        )}
        <StatusPill status={m.status} />
      </span>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    COMPLETED:   { color: "text-solid",     label: "Done" },
    IN_PROGRESS: { color: "text-heat",      label: "In progress" },
    BLOCKED:     { color: "text-fault",     label: "Blocked" },
    PENDING:     { color: "text-text-dim",  label: "Pending" },
  };
  const cfg = map[status] ?? map["PENDING"]!;
  return (
    <span className={`text-[10.5px] uppercase tracking-[0.1em] ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function Section({ title, right, children }: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-rule bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

