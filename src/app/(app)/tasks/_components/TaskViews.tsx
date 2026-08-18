// Task list views, split out of page.tsx for the §10 line limit.

import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Clock, AlertCircle, ExternalLink, CheckSquare, CalendarClock, Inbox } from "lucide-react";
import { CompleteButton } from "./CompleteButton";
import { refHref, dueLabel, urgencyBorder, fmtDate, type Tab } from "../page";

export function AllView({
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

export function FilteredView({
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

export const TAB_TITLE: Record<Tab, string> = {
  all:       "All Tasks",
  today:     "Due Today",
  upcoming:  "Upcoming",
  completed: "Completed",
};

// ── Section wrapper ───────────────────────────────────────────────────────────

export function Section({
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

export type TaskRow = {
  id: string; refType: string; refId: string; note: string;
  dueAt: Date; completedAt: Date | null; outcome: string | null;
  escalatedAt: Date | null;
};

export function TaskCard({
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

export function CompactEmpty({
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

export function StatCard({
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

export const REF_LABEL: Record<string, string> = {
  LEAD:      "Lead",
  PROJECT:   "Project",
  CLIENT:    "Client",
  QUOTATION: "Quotation",
  ORDER:     "Order",
  SNAG:      "Snag",
};
