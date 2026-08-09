"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSiteVisit } from "@/modules/site-visits/actions";

const PURPOSES = [
  { value: "INITIAL_SURVEY", label: "Initial Survey" },
  { value: "MEASUREMENT",    label: "Measurement" },
  { value: "SAMPLE_SHOWING", label: "Sample Showing" },
  { value: "SUPERVISION",    label: "Supervision" },
  { value: "SNAG_FIX",       label: "Snag Fix" },
  { value: "HANDOVER",       label: "Handover" },
];

export function NewVisitButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scheduledAt = fd.get("scheduledAt") as string;
    const data = {
      purpose:      fd.get("purpose") as string,
      scheduledAt:  scheduledAt ? new Date(scheduledAt).toISOString() : "",
      assignedToId: fd.get("assignedToId") as string,
      projectId:    (fd.get("projectId") as string) || undefined,
      observations: (fd.get("observations") as string) || undefined,
    };

    setError(null);
    startTransition(async () => {
      const res = await createSiteVisit(data);
      if (!res.ok) { setError(res.error ?? "Failed to create visit"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[32px] px-4 rounded-[8px] bg-accent text-ink text-[12px] font-semibold hover:bg-accent-strong transition-colors"
      >
        + Schedule Visit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] rounded-[14px] bg-surface border border-rule p-6 space-y-4"
          >
            <div className="font-display text-[17px] font-semibold">Schedule Site Visit</div>

            <div className="space-y-3">
              <Field label="Purpose">
                <select name="purpose" required className={inputCls}>
                  {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>

              <Field label="Scheduled at">
                <input type="datetime-local" name="scheduledAt" required className={inputCls} />
              </Field>

              <Field label="Project ID (optional)">
                <input type="text" name="projectId" placeholder="cuid…" className={inputCls} />
              </Field>

              <Field label="Assign to (User ID)">
                <input type="text" name="assignedToId" required placeholder="cuid…" className={inputCls} />
              </Field>

              <Field label="Initial observations">
                <textarea name="observations" rows={2} className={inputCls + " resize-none"} />
              </Field>
            </div>

            {error && <div className="text-[11.5px] text-fault">{error}</div>}

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setOpen(false)}
                className="h-[32px] px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:border-text-dim transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="h-[32px] px-4 rounded-[7px] text-[12px] font-semibold bg-accent text-ink hover:bg-accent-strong disabled:opacity-50 transition-colors">
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full h-[34px] px-2.5 rounded-[6px] border border-rule bg-surface-2 text-[12.5px] text-text placeholder:text-text-faint outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1">{label}</label>
      {children}
    </div>
  );
}
