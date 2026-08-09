"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addTask, setTaskStatus } from "@/modules/projects/actions";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/projects/schema";
import type { ProjectTask } from "@/modules/projects/queries";

const COLUMNS = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
const COLUMN_LABEL: Record<string, string> = {
  TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", BLOCKED: "Blocked",
};

export function TaskBoard({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
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
