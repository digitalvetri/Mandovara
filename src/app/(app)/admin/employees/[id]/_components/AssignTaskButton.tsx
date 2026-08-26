"use client";

// Owner-facing "Assign task" modal. Renders a button that opens a
// small form → creates a Task with the picked employee as assignee.
// Only rendered when the employee has a linked userId (otherwise
// there's nothing to point the task at).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { assignTaskToUser } from "@/modules/tasks/actions";
import { TASK_PRIORITIES } from "@/modules/projects/schema";

interface Props {
  employeeName:     string;
  assignedToUserId: string;
}

const lbl = "block mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim";
const inp = "w-full h-[34px] px-3 bg-surface-2 border border-rule rounded-[7px] text-[13px] text-text outline-none focus:border-accent transition-colors";

export function AssignTaskButton({ employeeName, assignedToUserId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title:       "",
    description: "",
    priority:    "NORMAL" as (typeof TASK_PRIORITIES)[number],
    dueDate:     "",
  });

  function reset() {
    setForm({ title: "", description: "", priority: "NORMAL", dueDate: "" });
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setError(null);
    start(async () => {
      const res = await assignTaskToUser({
        title:            form.title.trim(),
        description:      form.description.trim() || undefined,
        priority:         form.priority,
        dueDate:          form.dueDate || undefined,
        assignedToUserId,
      });
      if (!res.ok) { setError(res.error ?? "Could not assign task."); return; }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
      >
        <Plus size={13} /> Assign task
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Assign task to ${employeeName}`}
        >
          <div className="w-full max-w-[480px] rounded-[14px] border border-rule bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Assign task</div>
                <div className="text-[14px] font-semibold text-text mt-0.5">To {employeeName}</div>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                className="h-7 w-7 grid place-items-center rounded-full text-text-dim hover:text-text hover:bg-surface-hover"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className={lbl}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={inp}
                  placeholder="e.g. Deliver curtains to site"
                  autoFocus
                />
              </div>
              <div>
                <label className={lbl}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={`${inp} h-[80px] py-2 resize-y`}
                  placeholder="Add any details (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as (typeof TASK_PRIORITIES)[number] }))}
                    className={inp}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Due date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className={inp}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-[6px] bg-fault/10 border border-fault/30 px-3 py-2 text-[12px] text-fault">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  disabled={pending}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-text-dim hover:text-text hover:bg-surface-hover disabled:opacity-60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !form.title.trim()}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/85 disabled:opacity-60 transition-colors"
                >
                  {pending ? <><Loader2 size={13} className="animate-spin" /> Assigning…</> : <>Assign</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
