"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createSiteVisit, listAssignableUsers, type AssignableUser } from "@/modules/site-visits/actions";

const PURPOSES = [
  { value: "INITIAL_SURVEY", label: "Initial Survey" },
  { value: "MEASUREMENT",    label: "Measurement" },
  { value: "SAMPLE_SHOWING", label: "Sample Showing" },
  { value: "SUPERVISION",    label: "Supervision" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  leadId: string;
  // Kept in the API for callsite compatibility. Since the lead stage
  // simplification (25 Aug 2026) VISIT_SCHEDULED / CONTACTED / QUALIFIED
  // are no longer sanctioned; scheduling a visit no longer moves the
  // lead — it stays NEW until a quote is sent or the lead is converted.
  stage?: string;
}

export function ScheduleVisitModal({ open, onClose, leadId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);

  useEffect(() => {
    if (open) listAssignableUsers().then(setUsers).catch(() => setUsers([]));
  }, [open]);

  if (!open) return null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawAt = fd.get("scheduledAt") as string;
    setError(null);
    startTransition(async () => {
      const res = await createSiteVisit({
        leadId,
        purpose:      fd.get("purpose") as string,
        scheduledAt:  rawAt ? new Date(rawAt).toISOString() : "",
        assignedToId: fd.get("assignedToId") as string,
        observations: (fd.get("observations") as string) || undefined,
      });
      if (!res.ok) { setError(res.error ?? "Could not schedule visit"); return; }
      // Lead stage no longer auto-advances on visit scheduling — sanctioned
      // stages are NEW/QUOTED/WON/LOST only. Visits are a pre-conversion
      // touch; the lead stays NEW until a quote lands or it's converted.
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[14px] bg-surface border border-rule p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-[17px] font-semibold">Schedule Site Visit</div>
          <button type="button" onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 transition-colors">
            <X size={16} className="text-text-dim" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Purpose">
            <select name="purpose" required className={inputCls}>
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Scheduled at">
            <input type="datetime-local" name="scheduledAt" required className={inputCls} />
          </Field>

          <Field label="Assign to">
            <select name="assignedToId" required className={inputCls}>
              <option value="">Select team member…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              name="observations"
              rows={2}
              className={`${inputCls} h-auto py-2 resize-none`}
            />
          </Field>
        </div>

        {error && <div className="text-[11.5px] text-fault">{error}</div>}

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose}
            className="h-[32px] px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:border-text-dim transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={pending}
            className="h-[32px] px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent-strong disabled:opacity-50 transition-colors">
            {pending ? "Scheduling…" : "Schedule Visit"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full h-[34px] px-2.5 rounded-[6px] border border-rule bg-surface-2 text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
