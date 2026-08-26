"use client";

// Assignee-facing task list on the employee dashboard.
// Owner assigns via /admin/employees/[id]; the row shows up here for
// whoever the userId points to. The checkbox flips status → DONE via
// the markTaskDone server action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { markTaskDone } from "@/modules/tasks/actions";
import type { AssignedTaskRow } from "@/modules/tasks/queries";

const PRIORITY_CLS: Record<string, string> = {
  URGENT: "bg-fault/15 text-fault",
  HIGH:   "bg-heat/15 text-heat",
  NORMAL: "bg-surface-2 text-text-dim",
  LOW:    "bg-surface-2 text-text-faint",
};

export function MyTasksList({ tasks }: { tasks: AssignedTaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function complete(id: string) {
    setCompletingId(id);
    setError(null);
    start(async () => {
      const res = await markTaskDone({ id });
      setCompletingId(null);
      if (!res.ok) { setError(res.error ?? "Could not mark done"); return; }
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-rule bg-surface px-5 py-8 text-center">
        <div className="text-[13px] font-medium text-text-dim">No tasks assigned to you.</div>
        <div className="mt-1 text-[11.5px] text-text-faint">When someone assigns you a task, it&apos;ll show up here.</div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-2 rounded-[8px] border border-fault/30 bg-fault/8 px-3 py-2 text-[11.5px] text-fault">
          {error}
        </div>
      )}
      <ul className="divide-y divide-rule/60 rounded-[14px] border border-rule bg-surface overflow-hidden">
        {tasks.map((t) => {
          const isCompleting = pending && completingId === t.id;
          const due = t.dueAt ? formatDue(t.dueAt) : null;
          return (
            <li key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2/40 transition-colors">
              <button
                type="button"
                onClick={() => complete(t.id)}
                disabled={isCompleting}
                aria-label={`Mark "${t.title}" done`}
                className="mt-0.5 h-[18px] w-[18px] rounded-[5px] border border-rule flex items-center justify-center hover:border-accent hover:bg-accent/10 disabled:opacity-60 transition-colors"
              >
                {isCompleting
                  ? <Loader2 size={11} className="animate-spin text-accent" />
                  : <Check size={11} className="text-transparent hover:text-accent" strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-text">{t.title}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] px-1.5 py-0.5 rounded-[4px] ${PRIORITY_CLS[t.priority] ?? "bg-surface-2 text-text-dim"}`}>
                    {t.priority}
                  </span>
                  {due && (
                    <span className={`text-[11px] tabular ${due.cls}`}>{due.text}</span>
                  )}
                </div>
                {t.description && (
                  <div className="mt-1 text-[11.5px] text-text-dim line-clamp-2">{t.description}</div>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-text-faint">
                  <span>Assigned by {t.createdByName}</span>
                  {t.projectId && t.projectName && (
                    <>
                      <span aria-hidden>·</span>
                      <Link
                        href={`/projects/${t.projectId}` as Route}
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                      >
                        {t.projectName}
                        <ExternalLink size={9} strokeWidth={1.75} />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function formatDue(dueAt: Date): { text: string; cls: string } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(Date.UTC(dueAt.getUTCFullYear(), dueAt.getUTCMonth(), dueAt.getUTCDate()));
  const diff = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < -1)   return { text: `${Math.abs(diff)}d overdue`, cls: "text-fault" };
  if (diff === -1) return { text: "1d overdue",                 cls: "text-fault" };
  if (diff === 0)  return { text: "Due today",                  cls: "text-heat"  };
  if (diff === 1)  return { text: "Due tomorrow",               cls: "text-heat"  };
  if (diff <= 7)   return { text: `Due in ${diff}d`,            cls: "text-text-dim" };
  return { text: dueAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }), cls: "text-text-dim" };
}
