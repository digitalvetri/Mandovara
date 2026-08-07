"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFollowUp } from "@/modules/followups/actions";

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";

function isoTomorrow(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function LeadFollowUpForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dueAt, setDueAt] = useState<string>(isoTomorrow());
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFollowUp({ leadId, dueAt, note });
      if (!res.ok) { setError(res.error ?? "Could not create follow-up"); return; }
      setNote("");
      setDueAt(isoTomorrow());
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
        New follow-up
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3">
        <div>
          <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">Due</div>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={`${fieldCls} tabular`}
          />
        </div>
        <div>
          <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">Note</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What to talk about?"
            className={fieldCls}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="h-[34px] px-4 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
          >
            {pending ? "Saving…" : "Add"}
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-[12px] text-bad">{error}</div>}
      {savedAt && !error && (
        <div className="mt-3 text-[11.5px] text-text-dim">Follow-up scheduled.</div>
      )}
    </form>
  );
}
