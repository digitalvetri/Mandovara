"use client";

// Milestones + tasks + site-log panels for the project detail page.
// One client component owns the transitions so the whole page stays
// server-rendered otherwise.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, AlertCircle } from "lucide-react";
import {
  addMilestone, setMilestoneStatus, addTask, setTaskStatus, addSiteLog,
  addSnag, setSnagStatus, addProjectExpense, setProjectExpenseStatus,
  saveHandover,
} from "@/modules/projects/actions";
import {
  TASK_PRIORITIES, TASK_STATUSES,
  SNAG_STATUSES, EXPENSE_STATUSES, EXPENSE_CATEGORIES,
  HANDOVER_CHECKLIST_TEMPLATE,
} from "@/modules/projects/schema";
import { formatINR } from "@/kernel/money/format";
import type {
  ProjectMilestone, ProjectTask, ProjectSiteLog,
  ProjectSnag, ProjectExpenseRow, ProjectHandover,
} from "@/modules/projects/queries";

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  siteLogs: ProjectSiteLog[];
  snags: ProjectSnag[];
  expenses: ProjectExpenseRow[];
  handover: ProjectHandover | null;
}

export function ProjectPanels(p: Props) {
  return (
    <div className="space-y-4">
      <Milestones projectId={p.projectId} milestones={p.milestones} />
      <TaskBoard projectId={p.projectId} tasks={p.tasks} />
      <SiteLogs projectId={p.projectId} logs={p.siteLogs} />
      <Snags projectId={p.projectId} snags={p.snags} />
      <Expenses projectId={p.projectId} expenses={p.expenses} />
      <HandoverPanel projectId={p.projectId} handover={p.handover} />
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

// ── Snags ───────────────────────────────────────────────────────

const SNAG_TONE: Record<string, string> = {
  OPEN:        "bg-bad/12 text-bad",
  IN_PROGRESS: "bg-warn/12 text-warn",
  RESOLVED:    "bg-good/12 text-good",
  VERIFIED:    "bg-good/18 text-good",
};

function Snags({ projectId, snags }: { projectId: string; snags: ProjectSnag[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openCount = snags.filter((s) => s.status === "OPEN" || s.status === "IN_PROGRESS").length;

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addSnag({ projectId, location, description });
      if (!res.ok) { setError(res.error ?? "Could not raise snag"); return; }
      setLocation(""); setDescription(""); setOpen(false);
      router.refresh();
    });
  }
  function moveTo(id: string, status: (typeof SNAG_STATUSES)[number]) {
    setError(null);
    startTransition(async () => {
      const res = await setSnagStatus({ id, status });
      if (!res.ok) { setError(res.error ?? "Could not update snag"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim inline-flex items-center gap-2">
          <AlertCircle size={12} className={openCount > 0 ? "text-bad" : "text-text-faint"} />
          Snags ({snags.length}{openCount > 0 ? ` · ${openCount} open` : ""})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Raise snag
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule space-y-2">
          <div className="flex items-end gap-2">
            <div className="w-[220px]">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Location</div>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                     placeholder="e.g. Master bedroom — west wall"
                     className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">What&apos;s wrong?</div>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                     placeholder="e.g. Wallpaper seam not flush with corner"
                     className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
            </div>
            <button type="submit" disabled={pending || !location || !description}
                    className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
              Raise
            </button>
          </div>
        </form>
      )}
      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}
      {snags.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No snags raised — clean sheet.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {snags.map((s) => (
            <li key={s.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-text">{s.description}</div>
                <div className="text-[10.5px] text-text-dim tabular mt-0.5">
                  {s.location} · raised {fmt(s.createdAt)}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-[10px] text-[10.5px] uppercase tracking-[0.06em] ${SNAG_TONE[s.status] ?? ""}`}>
                {s.status.replace("_", " ").toLowerCase()}
              </span>
              <select value={s.status} onChange={(e) => moveTo(s.id, e.target.value as never)}
                      disabled={pending}
                      className="h-[26px] px-1 text-[10.5px] bg-white/60 border border-rule rounded-[4px] outline-none focus:border-accent">
                {SNAG_STATUSES.map((v) => <option key={v} value={v}>{v.replace("_"," ").toLowerCase()}</option>)}
              </select>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Project expenses ────────────────────────────────────────────

const EXPENSE_TONE: Record<string, string> = {
  DRAFT:     "bg-white/8 text-text-dim",
  SUBMITTED: "bg-accent/12 text-accent",
  APPROVED:  "bg-good/12 text-good",
  REJECTED:  "bg-bad/12 text-bad",
  PAID:      "bg-good/18 text-good",
};

function Expenses({ projectId, expenses }: { projectId: string; expenses: ProjectExpenseRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("TRANSPORT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [spentAt, setSpentAt] = useState(iso(new Date()));
  const [error, setError] = useState<string | null>(null);

  const approvedTotal = expenses
    .filter((e) => e.status === "APPROVED" || e.status === "PAID")
    .reduce((s, e) => s + e.amount, 0n);

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addProjectExpense({ projectId, category, amount, description, spentAt });
      if (!res.ok) { setError(res.error ?? "Could not save expense"); return; }
      setAmount(""); setDescription(""); setOpen(false);
      router.refresh();
    });
  }
  function moveTo(id: string, status: (typeof EXPENSE_STATUSES)[number]) {
    setError(null);
    startTransition(async () => {
      const res = await setProjectExpenseStatus({ id, status });
      if (!res.ok) { setError(res.error ?? "Could not update"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Site expenses ({expenses.length})
          {approvedTotal > 0n && (
            <span className="ml-2 text-text-faint normal-case tracking-normal">
              approved <span className="tabular text-text-dim">{formatINR(approvedTotal)}</span>
            </span>
          )}
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add expense
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule space-y-2">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Date</div>
              <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
                     className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Category</div>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                     list="exp-cat-suggestions"
                     className="h-[30px] w-[150px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] uppercase outline-none focus:border-accent" />
              <datalist id="exp-cat-suggestions">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)}
                     inputMode="decimal" placeholder="e.g. 2500"
                     className="h-[30px] w-[120px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Note</div>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                     placeholder="Optional detail"
                     className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
            </div>
            <button type="submit" disabled={pending || !amount || !category}
                    className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
              Save
            </button>
          </div>
        </form>
      )}
      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}
      {expenses.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No expenses logged.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {expenses.map((e) => (
            <li key={e.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-[70px] text-[10.5px] text-text-dim tabular">{fmt(e.spentAt)}</div>
              <div className="w-[110px] text-[11px] uppercase tracking-[0.06em] text-text-dim">{e.category}</div>
              <div className="flex-1 min-w-0 text-[12.5px] text-text truncate">{e.description ?? "—"}</div>
              <div className="w-[110px] text-right tabular text-[12.5px] text-text">{formatINR(e.amount)}</div>
              <span className={`px-2 py-0.5 rounded-[10px] text-[10.5px] uppercase tracking-[0.06em] w-[80px] text-center ${EXPENSE_TONE[e.status] ?? ""}`}>
                {e.status.toLowerCase()}
              </span>
              <select value={e.status} onChange={(ev) => moveTo(e.id, ev.target.value as never)}
                      disabled={pending}
                      className="h-[26px] px-1 text-[10.5px] bg-white/60 border border-rule rounded-[4px] outline-none focus:border-accent">
                {EXPENSE_STATUSES.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
              </select>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Handover ────────────────────────────────────────────────────

type ChecklistState = Record<string, { checked: boolean; note?: string }>;

function HandoverPanel({
  projectId, handover,
}: { projectId: string; handover: ProjectHandover | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local draft — hydrated from the server row (if any) plus the template.
  const [draft, setDraft] = useState<ChecklistState>(() => hydrate(handover?.checklist));

  const totalItems   = HANDOVER_CHECKLIST_TEMPLATE.length;
  const checkedItems = HANDOVER_CHECKLIST_TEMPLATE.filter((i) => draft[i.key]?.checked).length;
  const complete     = checkedItems === totalItems;
  const percent      = Math.round((checkedItems / totalItems) * 100);

  function toggle(key: string) {
    setDraft((d) => ({
      ...d,
      [key]: { ...(d[key] ?? { checked: false }), checked: !d[key]?.checked },
    }));
  }
  function setNote(key: string, note: string) {
    setDraft((d) => ({
      ...d,
      [key]: { ...(d[key] ?? { checked: false }), note },
    }));
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveHandover({ projectId, checklist: draft });
      if (!res.ok) { setError(res.error ?? "Could not save handover"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Handover
          <span className="ml-2 text-text-faint normal-case tracking-normal">
            <span className="tabular text-text-dim">{checkedItems}/{totalItems}</span> · {percent}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {complete && (
            <span className="px-2 py-0.5 rounded-[10px] text-[10.5px] uppercase tracking-[0.06em] bg-good/18 text-good">
              Complete
            </span>
          )}
          {handover && (
            <span className="text-[10.5px] text-text-dim tabular">
              Last saved {fmt(handover.handedOverAt)}
            </span>
          )}
        </div>
      </div>

      {/* Progress hairline — matches the gold-underline motif in §6.1 */}
      <div className="h-[2px] w-full bg-rule/40 relative">
        <div
          className={`absolute inset-y-0 left-0 transition-all ${complete ? "bg-good" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}

      <ul className="divide-y divide-rule/60">
        {HANDOVER_CHECKLIST_TEMPLATE.map((item) => {
          const st = draft[item.key] ?? { checked: false };
          return (
            <li key={item.key} className="px-4 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={st.checked}
                  onChange={() => toggle(item.key)}
                  className="mt-[3px] h-[16px] w-[16px] accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <div className={st.checked ? "text-[12.5px] text-text-dim line-through" : "text-[12.5px] text-text"}>
                    {item.label}
                  </div>
                  <input
                    type="text"
                    value={st.note ?? ""}
                    onChange={(e) => setNote(item.key, e.target.value)}
                    placeholder="Note (optional)"
                    className="mt-1 w-full h-[26px] px-2 bg-white/60 border border-rule rounded-[6px] text-[11.5px] outline-none focus:border-accent"
                  />
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t border-rule flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : complete ? "Save & mark complete" : "Save progress"}
        </button>
      </div>
    </div>
  );
}

function hydrate(existing?: ChecklistState): ChecklistState {
  const out: ChecklistState = {};
  for (const item of HANDOVER_CHECKLIST_TEMPLATE) {
    out[item.key] = existing?.[item.key] ?? { checked: false };
  }
  return out;
}

// ── helpers ────────────────────────────────────────────────────

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}
