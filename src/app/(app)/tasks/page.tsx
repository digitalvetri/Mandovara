/* eslint-disable max-lines -- FIXME: split into smaller files (currently 512 lines) */
import Link from "next/link";
import type { Route } from "next";
import {
  CheckCircle2, Clock, AlertCircle, ExternalLink,
  CheckSquare, CalendarClock, Inbox,
} from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { CompleteButton } from "./_components/CompleteButton";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function dueLabel(dueAt: Date, today: Date): { text: string; cls: string; urgent: boolean } {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: "text-fault",     urgent: true  };
  if (diff === -1) return { text: "1d overdue",               cls: "text-fault",     urgent: true  };
  if (diff === 0)  return { text: "Due today",                cls: "text-heat",      urgent: true  };
  if (diff === 1)  return { text: "Due tomorrow",             cls: "text-heat",      urgent: false };
  if (diff <= 7)   return { text: `In ${diff} days`,          cls: "text-text-muted",urgent: false };
  return               { text: fmtDate(dueAt),               cls: "text-text-muted",urgent: false };
}

function urgencyBorder(dueAt: Date, today: Date): string {
  const diff = Math.floor((dueAt.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return "border-l-fault/70";
  if (diff === 0) return "border-l-heat/70";
  return "border-l-border/40";
}

function refHref(refType: string, refId: string): string | null {
  const map: Record<string, string> = {
    LEAD:      `/leads/${refId}`,
    PROJECT:   `/projects/${refId}`,
    CLIENT:    `/clients/${refId}`,
    QUOTATION: `/quotations/${refId}`,
    ORDER:     `/orders/${refId}`,
  };
  return map[refType] ?? null;
}

type Tab = "all" | "today" | "upcoming" | "completed";

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

function AllView({
  overdue, today, upcoming, nameMap, todayUTC,
}: {
  overdue: TaskRow[];
  today: TaskRow[];
  upcoming: TaskRow[];
  nameMap: Record<string, string>;
  todayUTC: Date;
}) {
  const nothing = overdue.length === 0 && today.length === 0 && upcoming.length === 0;

  if (nothing) return <CompactEmpty />;

  return (
    <div className="space-y-4 pb-8">
      {overdue.length > 0 && (
        <Section
          title="Overdue"
          count={overdue.length}
          accent="border-l-[3px] border-l-fault/60"
          headerCls="text-fault"
        >
          {overdue.map((t) => (
            <TaskCard key={t.id} task={t} nameMap={nameMap} todayUTC={todayUTC} />
          ))}
        </Section>
      )}
      {today.length > 0 && (
        <Section
          title="Due Today"
          count={today.length}
          accent="border-l-[3px] border-l-heat/60"
          headerCls="text-heat"
        >
          {today.map((t) => (
            <TaskCard key={t.id} task={t} nameMap={nameMap} todayUTC={todayUTC} />
          ))}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section title="Upcoming" count={upcoming.length}>
          {upcoming.map((t) => (
            <TaskCard key={t.id} task={t} nameMap={nameMap} todayUTC={todayUTC} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ── Filtered view (today / upcoming / completed tabs) ─────────────────────────

function FilteredView({
  tasks, nameMap, todayUTC, completed, tab, todayCount, upcomingCount,
}: {
  tasks: TaskRow[];
  nameMap: Record<string, string>;
  todayUTC: Date;
  completed: boolean;
  tab: Tab;
  todayCount: number;
  upcomingCount: number;
}) {
  if (tasks.length === 0) {
    if (tab === "today" && todayCount === 0)
      return <CompactEmpty icon={<CalendarClock size={28} strokeWidth={1.3} />} title="Nothing due today" sub="Check Upcoming for tasks due later this week." />;
    if (tab === "upcoming" && upcomingCount === 0)
      return <CompactEmpty icon={<CalendarClock size={28} strokeWidth={1.3} />} title="No upcoming tasks" sub="You&apos;re all caught up ahead of schedule." />;
    if (tab === "completed")
      return <CompactEmpty icon={<CheckSquare size={28} strokeWidth={1.3} />} title="No completed tasks yet" sub="Tasks you mark done will appear here." />;
    return <CompactEmpty />;
  }

  return (
    <div className="pb-8">
      <div className="rounded-[12px] border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            {TAB_TITLE[tab]}
          </span>
          <span className="font-data tabular-nums text-[11px] text-text-subtle">{tasks.length} tasks</span>
        </div>
        <div className="divide-y divide-border/40">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              nameMap={nameMap}
              todayUTC={todayUTC}
              completed={completed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const TAB_TITLE: Record<Tab, string> = {
  all:       "All Tasks",
  today:     "Due Today",
  upcoming:  "Upcoming",
  completed: "Completed",
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, count, accent = "", headerCls = "text-text-muted", children,
}: {
  title: string;
  count: number;
  accent?: string;
  headerCls?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[12px] border border-border bg-surface overflow-hidden ${accent}`}>
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${headerCls}`}>
          {title}
        </span>
        <span className="font-data tabular-nums text-[11px] text-text-subtle">{count}</span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

// ── Task card row ─────────────────────────────────────────────────────────────

type TaskRow = {
  id: string; refType: string; refId: string; note: string;
  dueAt: Date; completedAt: Date | null; outcome: string | null;
  escalatedAt: Date | null;
};

function TaskCard({
  task, nameMap, todayUTC, completed = false,
}: {
  task: TaskRow;
  nameMap: Record<string, string>;
  todayUTC: Date;
  completed?: boolean;
}) {
  const isCompleted = completed || !!task.completedAt;
  const href        = refHref(task.refType, task.refId);
  const refName     = nameMap[task.refId];
  const due         = isCompleted ? null : dueLabel(task.dueAt, todayUTC);
  const borderCls   = isCompleted ? "border-l-[3px] border-l-solid/30" : `border-l-[3px] ${urgencyBorder(task.dueAt, todayUTC)}`;

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2/40 transition-colors ${borderCls}`}>

      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {isCompleted
          ? <CheckCircle2 size={15} strokeWidth={1.8} className="text-solid" />
          : due?.urgent
            ? <AlertCircle size={15} strokeWidth={1.8} className="text-fault" />
            : <Clock size={15} strokeWidth={1.8} className="text-text-muted" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Note */}
        <p className={[
          "text-[13px] leading-snug",
          isCompleted ? "line-through text-text-muted" : "text-text",
        ].join(" ")}>
          {task.note}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {/* Ref type chip */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-surface-2 border border-border/60 text-[10.5px] font-medium text-text-muted">
            {REF_LABEL[task.refType] ?? task.refType}
          </span>

          {/* Ref name */}
          {refName && (
            <span className="text-[11.5px] text-text-muted truncate max-w-[180px]">{refName}</span>
          )}

          {/* Urgency pill (pending) */}
          {!isCompleted && due && (
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${due.cls}`}>
              {due.urgent && <AlertCircle size={10} strokeWidth={2.5} />}
              {due.text}
            </span>
          )}

          {/* Escalated marker */}
          {task.escalatedAt && !isCompleted && (
            <span className="text-[10.5px] font-semibold text-fault px-1.5 py-0.5 rounded-[4px] bg-fault/10">
              Escalated
            </span>
          )}

          {/* Completed date */}
          {isCompleted && task.completedAt && (
            <span className="text-[11.5px] text-text-muted">
              Done {fmtDate(task.completedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {href && (
          <Link
            href={href as Route}
            className="p-1.5 rounded-[6px] text-text-subtle hover:text-text hover:bg-surface-2 transition-colors"
            title="Open record"
          >
            <ExternalLink size={12} strokeWidth={1.8} />
          </Link>
        )}
        {!isCompleted && <CompleteButton id={task.id} />}
      </div>
    </div>
  );
}

// ── Compact empty state ───────────────────────────────────────────────────────

function CompactEmpty({
  icon, title, sub,
}: {
  icon?: React.ReactNode;
  title?: string;
  sub?: string;
} = {}) {
  return (
    <div className="rounded-[12px] border border-border border-dashed bg-surface/50 flex flex-col items-center justify-center py-14 text-center px-4 mb-8">
      <div className="text-text-muted/40 mb-3">
        {icon ?? <Inbox size={28} strokeWidth={1.3} />}
      </div>
      <p className="text-[13.5px] font-medium text-text mb-1">
        {title ?? "All clear"}
      </p>
      <p className="text-[12.5px] text-text-muted max-w-xs leading-snug">
        {sub ?? "You have no pending tasks right now. Tasks assigned to you will appear here."}
      </p>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  value, label, sub, color, bg,
}: {
  value: number;
  label: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-[12px] border border-border bg-surface p-4 ${bg}`}>
      <p className={`font-data tabular-nums text-[28px] font-semibold leading-none ${color}`}>
        {value}
      </p>
      <p className="text-[12px] font-semibold text-text mt-1.5">{label}</p>
      <p className="text-[11px] text-text-subtle mt-0.5">{sub}</p>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REF_LABEL: Record<string, string> = {
  LEAD:      "Lead",
  PROJECT:   "Project",
  CLIENT:    "Client",
  QUOTATION: "Quotation",
  ORDER:     "Order",
  SNAG:      "Snag",
};
