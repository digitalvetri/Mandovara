import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard, AllView, FilteredView } from "./_components/TaskViews";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export function dueLabel(dueAt: Date, today: Date): { text: string; cls: string; urgent: boolean } {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: "text-fault",     urgent: true  };
  if (diff === -1) return { text: "1d overdue",               cls: "text-fault",     urgent: true  };
  if (diff === 0)  return { text: "Due today",                cls: "text-heat",      urgent: true  };
  if (diff === 1)  return { text: "Due tomorrow",             cls: "text-heat",      urgent: false };
  if (diff <= 7)   return { text: `In ${diff} days`,          cls: "text-text-muted",urgent: false };
  return               { text: fmtDate(dueAt),               cls: "text-text-muted",urgent: false };
}

export function urgencyBorder(dueAt: Date, today: Date): string {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return "border-l-fault/70";
  if (diff === 0) return "border-l-heat/70";
  return "border-l-border/40";
}

export function refHref(refType: string, refId: string): string | null {
  const map: Record<string, string> = {
    LEAD:      `/leads/${refId}`,
    PROJECT:   `/projects/${refId}`,
    CLIENT:    `/clients/${refId}`,
    QUOTATION: `/quotations/${refId}`,
    ORDER:     `/orders/${refId}`,
  };
  return map[refType] ?? null;
}

export type Tab = "all" | "today" | "upcoming" | "completed";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const tab    = (params["tab"] ?? "all") as Tab;

  const ctx   = await devContext();
  const db    = scoped(ctx);
  const today = todayUTC();

  // Fetch all pending + recent completed for stats
  const [allPending, allCompleted] = await Promise.all([
    db.followUp.findMany({
      where:   { ownerId: ctx.userId, completedAt: null },
      orderBy: { dueAt: "asc" },
    }),
    db.followUp.findMany({
      where:   { ownerId: ctx.userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take:    30,
    }),
  ]);

  // Summary counts
  const overdueCount  = allPending.filter((t) => t.dueAt < today).length;
  const todayCount    = allPending.filter((t) => {
    const diff = Math.floor((t.dueAt.getTime() - today.getTime()) / 86_400_000);
    return diff === 0;
  }).length;
  const upcomingCount = allPending.filter((t) => t.dueAt > today).length;
  const completedCount = allCompleted.length;

  // Decide which tasks to show based on tab
  let displayTasks: typeof allPending | typeof allCompleted = [];
  let showCompleted = false;

  if (tab === "today") {
    displayTasks = allPending.filter((t) => {
      const diff = Math.floor((t.dueAt.getTime() - today.getTime()) / 86_400_000);
      return diff === 0;
    });
  } else if (tab === "upcoming") {
    displayTasks = allPending.filter((t) => t.dueAt > today);
  } else if (tab === "completed") {
    displayTasks  = allCompleted;
    showCompleted = true;
  } else {
    displayTasks = allPending; // "all" — grouped by section below
  }

  // Batch-load referenced entity names for display
  const allTasks = [...allPending, ...allCompleted];
  const refsByType: Record<string, string[]> = {};
  for (const t of allTasks) {
    (refsByType[t.refType] ??= []).push(t.refId);
  }

  const [leads, projects, clients] = await Promise.all([
    refsByType["LEAD"]
      ? db.lead.findMany({ where: { id: { in: refsByType["LEAD"] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    refsByType["PROJECT"]
      ? db.project.findMany({ where: { id: { in: refsByType["PROJECT"] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    refsByType["CLIENT"]
      ? db.client.findMany({ where: { id: { in: refsByType["CLIENT"] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const nameMap: Record<string, string> = {};
  for (const r of [...leads, ...projects, ...clients]) nameMap[r.id] = r.name;

  // For "all" tab, split into groups
  const overdueTasks  = allPending.filter((t) => t.dueAt < today);
  const todayTasks    = allPending.filter((t) => {
    const diff = Math.floor((t.dueAt.getTime() - today.getTime()) / 86_400_000);
    return diff === 0;
  });
  const upcomingTasks = allPending.filter((t) => t.dueAt > today);

  const totalPending = allPending.length;

  return (
    <>
      <Topbar
        title="My Tasks"
        eyebrow={totalPending > 0 ? `${totalPending} pending` : "All clear"}
      />

      {/* ── SUMMARY STATS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard
          value={totalPending}
          label="Pending"
          sub="total open"
          color="text-text"
          bg=""
        />
        <StatCard
          value={overdueCount}
          label="Overdue"
          sub={overdueCount > 0 ? "needs attention" : "none overdue"}
          color={overdueCount > 0 ? "text-fault" : "text-text-muted"}
          bg={overdueCount > 0 ? "bg-fault/5 border-fault/20" : ""}
        />
        <StatCard
          value={todayCount}
          label="Due Today"
          sub={todayCount > 0 ? "action needed" : "nothing today"}
          color={todayCount > 0 ? "text-heat" : "text-text-muted"}
          bg={todayCount > 0 ? "bg-heat/5 border-heat/20" : ""}
        />
        <StatCard
          value={completedCount}
          label="Completed"
          sub="this month"
          color="text-solid"
          bg=""
        />
      </div>

      {/* ── FILTER TABS ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-[10px] bg-surface-2/60 border border-border/60 w-fit">
        {([
          ["all",       `All (${totalPending})`          ],
          ["today",     `Due Today (${todayCount})`      ],
          ["upcoming",  `Upcoming (${upcomingCount})`    ],
          ["completed", `Completed (${completedCount})`  ],
        ] as [Tab, string][]).map(([t, label]) => (
          <Link
            key={t}
            href={`/tasks?tab=${t}` as Route}
            className={[
              "px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-all whitespace-nowrap",
              tab === t
                ? "bg-surface border border-border text-text shadow-sm"
                : "text-text-muted hover:text-text",
            ].join(" ")}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── TASK LIST ─────────────────────────────────────────────────── */}
      {tab === "all" ? (
        <AllView
          overdue={overdueTasks}
          today={todayTasks}
          upcoming={upcomingTasks}
          nameMap={nameMap}
          todayUTC={today}
        />
      ) : (
        <FilteredView
          tasks={displayTasks}
          nameMap={nameMap}
          todayUTC={today}
          completed={showCompleted}
          tab={tab}
          todayCount={todayCount}
          upcomingCount={upcomingCount}
        />
      )}
    </>
  );
}

// ── All-tab grouped view ──────────────────────────────────────────────────────
