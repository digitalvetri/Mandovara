"use client";

// Milestones + tasks + site-log panels for the project detail page.
// One client component owns the transitions so the whole page stays
// server-rendered otherwise.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import {
  addMilestone, setMilestoneStatus, addTask, setTaskStatus, addSiteLog,
} from "@/modules/projects/actions";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/projects/schema";
import type { ProjectMilestone, ProjectTask, ProjectSiteLog } from "@/modules/projects/queries";

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  siteLogs: ProjectSiteLog[];
}

export function ProjectPanels(p: Props) {
  return (
    <div className="space-y-4">
      <Milestones projectId={p.projectId} milestones={p.milestones} />
      <TaskBoard projectId={p.projectId} tasks={p.tasks} />
      <SiteLogs projectId={p.projectId} logs={p.siteLogs} />
    </div>
  );
}

// ── Milestones ──────────────────────────────────────────────────

function Milestones({ projectId, milestones }: { projectId: string; milestones: ProjectMilestone[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plannedDate, setPlannedDate] = useState(iso(new Date()));
  const [billingPct, setBillingPct] = useState("25");

  const [error, setError] = useState<string | null>(null);
  function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addMilestone({ projectId, name, plannedDate, billingPct: Number(billingPct) });
      if (!res.ok) { setError(res.error ?? "Could not add milestone"); return; }
      setName(""); setBillingPct("25"); setOpen(false);
      router.refresh();
    });
  }
  function complete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await setMilestoneStatus({ id, status: "COMPLETED" });
      if (!res.ok) { setError(res.error ?? "Could not complete"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Milestones ({milestones.length})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add milestone
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Planned</div>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)}
                   className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
          </div>
          <div className="w-[80px]">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Billing %</div>
            <input value={billingPct} onChange={(e) => setBillingPct(e.target.value)}
                   className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={pending || !name}
                  className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
            Add
          </button>
        </form>
      )}
      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}
      {milestones.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No milestones yet.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {milestones.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="tabular text-[11px] text-text-dim w-[24px]">{m.order}.</div>
              <div className="flex-1">
                <div className={m.status === "COMPLETED" ? "text-[12.5px] text-text-dim line-through" : "text-[12.5px] text-text"}>{m.name}</div>
                <div className="text-[10.5px] text-text-dim tabular">
                  Planned {fmt(m.plannedDate)}
                  {m.actualDate && <span className="text-good"> · done {fmt(m.actualDate)}</span>}
                </div>
              </div>
              <div className="text-[10.5px] text-text-dim tabular w-[60px] text-right">{m.billingPct}%</div>
              {m.status !== "COMPLETED" && (
                <button type="button" onClick={() => complete(m.id)} disabled={pending}
                        className="inline-flex items-center gap-1 h-[26px] px-2 rounded-[4px] text-[11px] bg-good/12 text-good hover:bg-good/20 transition-colors disabled:opacity-60">
                  <Check size={11} /> Complete
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Task board ──────────────────────────────────────────────────

const COLUMNS = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
const COLUMN_LABEL: Record<string, string> = {
  TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", BLOCKED: "Blocked",
};

function TaskBoard({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addTask({ projectId, title, priority, dueDate: dueDate || undefined });
      if (!res.ok) { setError(res.error ?? "Could not add task"); return; }
      setTitle(""); setDueDate(""); setOpen(false);
      router.refresh();
    });
  }
  function moveTo(id: string, status: (typeof TASK_STATUSES)[number]) {
    setError(null);
    startTransition(async () => {
      const res = await setTaskStatus({ id, status });
      if (!res.ok) { setError(res.error ?? "Could not move task"); return; }
      router.refresh();
    });
  }

  const groups = new Map<string, ProjectTask[]>();
  for (const c of COLUMNS) groups.set(c, []);
  for (const t of tasks) groups.get(t.status)?.push(t);

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Tasks ({tasks.length})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add task
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
                   className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Priority</div>
            <select value={priority} onChange={(e) => setPriority(e.target.value as never)}
                    className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent">
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Due</div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                   className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={pending || !title}
                  className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
            Add
          </button>
        </form>
      )}
      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}
      <div className="p-3 grid grid-cols-4 gap-3">
        {COLUMNS.map((col) => (
          <div key={col} className="bg-bg/50 border border-rule/60 rounded-[8px] p-2 min-h-[100px]">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-2 flex items-center justify-between">
              <span>{COLUMN_LABEL[col]}</span>
              <span className="tabular text-[10.5px] text-text-faint">{groups.get(col)!.length}</span>
            </div>
            <ul className="space-y-1.5">
              {groups.get(col)!.map((t) => (
                <li key={t.id} className="bg-surface border border-rule rounded-[6px] p-2 text-[11.5px]">
                  <div className="text-text">{t.title}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <PriorityDot p={t.priority} />
                    <select value={t.status} onChange={(e) => moveTo(t.id, e.target.value as never)}
                            disabled={pending}
                            className="h-[22px] px-1 text-[10.5px] bg-white/60 border border-rule rounded-[4px] outline-none focus:border-accent">
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{COLUMN_LABEL[s]}</option>)}
                    </select>
                  </div>
                </li>
              ))}
              {groups.get(col)!.length === 0 && (
                <li className="text-[10.5px] text-text-faint text-center py-3">—</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityDot({ p }: { p: string }) {
  const tone = p === "URGENT" ? "bg-bad" : p === "HIGH" ? "bg-warn" : p === "MEDIUM" ? "bg-accent/60" : "bg-text-faint";
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] text-text-dim">
      <span className={`h-2 w-2 rounded-full ${tone}`} />
      {p.toLowerCase()}
    </span>
  );
}

// ── Site logs ───────────────────────────────────────────────────

function SiteLogs({ projectId, logs }: { projectId: string; logs: ProjectSiteLog[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [weather, setWeather] = useState("");
  const [manpower, setManpower] = useState("");
  const [loggedAt, setLoggedAt] = useState(iso(new Date()));

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await addSiteLog({
        projectId, summary, weather, loggedAt,
        ...(manpower !== "" && { manpowerCount: Number(manpower) }),
      });
      setSummary(""); setWeather(""); setManpower(""); setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Site logs ({logs.length})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add log
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule space-y-2">
          <div className="flex items-end gap-2">
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Date</div>
              <input type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)}
                     className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Weather</div>
              <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Rainy"
                     className="h-[30px] w-[130px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Manpower</div>
              <input inputMode="numeric" value={manpower} onChange={(e) => setManpower(e.target.value)}
                     className="h-[30px] w-[90px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Summary</div>
            <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)}
                      placeholder="What happened at site today?"
                      className="w-full px-2 py-1.5 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pending || !summary}
                    className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
              Add log
            </button>
          </div>
        </form>
      )}
      {logs.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No site logs yet.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="text-[11px] text-text-dim tabular flex items-center gap-3">
                <span>{fmt(l.loggedAt)}</span>
                {l.weather && <span>· {l.weather}</span>}
                {l.manpowerCount != null && <span>· {l.manpowerCount} on site</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-text">{l.summary}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}
