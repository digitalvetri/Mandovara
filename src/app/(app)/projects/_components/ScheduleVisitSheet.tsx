"use client";

// Inline "Schedule Site Visit" sheet — opens from the Next Action hero
// on ENQUIRY-stage projects. Pre-fills the project id, defaults the
// assignee to the current user, and calls createSiteVisit directly.
//
// The site-visits module already has its own list-page modal
// (NewVisitButton) but that one asks the user to type a project cuid.
// Here we know the project — one less form field to fill.

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { createSiteVisit, listAssignableUsers, type AssignableUser } from "@/modules/site-visits/actions";
import { formatDate } from "@/kernel/datetime";

const PURPOSES = [
  { value: "INITIAL_SURVEY", label: "Initial survey" },
  { value: "MEASUREMENT",    label: "Measurement" },
  { value: "SAMPLE_SHOWING", label: "Sample showing" },
  { value: "SUPERVISION",    label: "Supervision" },
  { value: "SNAG_FIX",       label: "Snag fix" },
  { value: "HANDOVER",       label: "Handover" },
];

interface Props {
  projectId: string;
  defaultAssigneeId: string;
  open: boolean;
  onClose: () => void;
}

interface SuccessState {
  id: string;
  number: string;
  scheduledAt: Date;
  stageAdvanced: boolean;
}

export function ScheduleVisitSheet({ projectId, defaultAssigneeId, open, onClose }: Props) {
  const router = useRouter();
  const [purpose, setPurpose]         = useState("INITIAL_SURVEY");
  const [scheduledAt, setScheduledAt] = useState(defaultDatetime());
  const [assigneeId, setAssigneeId]   = useState(defaultAssigneeId);
  const [notes, setNotes]             = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<SuccessState | null>(null);
  const [pending, start]              = useTransition();
  const [users, setUsers]             = useState<AssignableUser[]>([]);

  useEffect(() => {
    listAssignableUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  if (!open) return null;

  function submit(): void {
    setError(null);
    start(async () => {
      const res = await createSiteVisit({
        projectId,
        purpose,
        scheduledAt:  new Date(scheduledAt).toISOString(),
        assignedToId: assigneeId,
        observations: notes.trim() || undefined,
      });
      if (!res.ok || !res.data) { setError(res.error ?? "Could not schedule visit"); return; }
      setSuccess({
        id:            res.data.id,
        number:        res.data.number,
        scheduledAt:   new Date(res.data.scheduledAt),
        stageAdvanced: res.data.stageAdvanced,
      });
      router.refresh();
    });
  }

  function closeAndReset(): void {
    setSuccess(null);
    setError(null);
    setNotes("");
    onClose();
  }

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Site visit scheduled"
      >
        <div className="w-full max-w-[460px] rounded-[14px] border border-rule bg-surface p-6">
          <div className="mb-3 flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-solid/12 p-2 text-solid">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-[19px] font-semibold text-text">
                Visit scheduled
              </h2>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-dim">
                <span className="tabular-nums text-text">{success.number}</span>
                {" · "}
                {formatDate(success.scheduledAt)}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-[10px] border border-rule bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-text-dim">
            {success.stageAdvanced ? (
              <>The visit is now on the assignee&apos;s schedule and the project has moved to <span className="text-text">Site Visit</span>. You can track it here or in the Site Visits list.</>
            ) : (
              <>The visit is now on the assignee&apos;s schedule. You can track it on this project or in the Site Visits list.</>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/site-visits/${success.id}` as Route}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule px-3.5 py-2 text-[12.5px] text-text-dim hover:text-text"
            >
              Open visit
              <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={closeAndReset}
              className="rounded-[8px] bg-gold px-5 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule site visit"
    >
      <div className="w-full max-w-[460px] rounded-[14px] border border-rule bg-surface p-6">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-display text-[19px] font-semibold text-text">Schedule site visit</h2>
          <button
            type="button"
            onClick={closeAndReset}
            className="rounded-[6px] p-1 text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 text-[12px] leading-relaxed text-text-dim">
          A team member goes to the site with a specific purpose. Measurement, sample-showing and snag-fix all begin here. Scheduling this visit moves the project to <span className="text-text">Site Visit</span>.
        </p>

        <div className="space-y-3">
          <Field label="Purpose">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={inputCls}
            >
              {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <Field label="Scheduled at">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputCls}
              required
            />
          </Field>

          <Field label="Assign to">
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
              required
            >
              {users.length === 0 && (
                <option value={assigneeId}>{assigneeId ? "Loading…" : "Select team member"}</option>
              )}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              className={inputCls + " resize-none py-2"}
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeAndReset}
            disabled={pending}
            className="rounded-[8px] px-4 py-2 text-[12.5px] text-text-dim hover:text-text disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !scheduledAt || !assigneeId}
            className="inline-flex items-center gap-2 rounded-[8px] bg-gold px-5 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 rounded-[8px] border border-rule bg-surface-2 px-3 text-[12.5px] text-text outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</label>
      {children}
    </div>
  );
}

function defaultDatetime(): string {
  // Default to tomorrow 10 AM local.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
