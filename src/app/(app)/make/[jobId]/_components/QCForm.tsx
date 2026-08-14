"use client";

import { useState, useTransition } from "react";
import { submitQC } from "@/modules/make/qc-actions";
import { CheckCircle, XCircle } from "lucide-react";

export function QCForm({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [defects, setDefects] = useState("");
  const [reworkNotes, setReworkNotes] = useState("");
  const [mode, setMode] = useState<"pass" | "fail" | null>(null);

  function submit(passed: boolean) {
    if (!passed && !defects.trim()) {
      setError("Describe the defects before failing QC.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitQC({
        makeJobId: jobId,
        passed,
        defects: passed ? undefined : defects,
        reworkNotes: passed ? undefined : reworkNotes,
        qcDate: new Date().toISOString(),
      });
      if (!result.ok) setError(result.error ?? "Failed");
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
        QC Inspection
      </p>

      {mode === "fail" && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Defects found *</label>
            <textarea
              value={defects}
              onChange={(e) => setDefects(e.target.value)}
              rows={2}
              placeholder="Describe defects…"
              className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-subtle outline-none focus:border-gold resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-text-muted mb-1">Rework instructions</label>
            <textarea
              value={reworkNotes}
              onChange={(e) => setReworkNotes(e.target.value)}
              rows={2}
              placeholder="What needs to be fixed…"
              className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-subtle outline-none focus:border-gold resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => submit(false)}
              disabled={pending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-fault/20 border border-fault/40 text-fault text-[12px] font-medium hover:bg-fault/30 transition-colors disabled:opacity-60"
            >
              <XCircle size={13} />
              {pending ? "Saving…" : "Confirm Fail → Rework"}
            </button>
            <button
              onClick={() => setMode(null)}
              className="h-8 px-3 rounded-md text-[12px] text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode !== "fail" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => submit(true)}
            disabled={pending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-solid/20 border border-solid/40 text-solid text-[12px] font-medium hover:bg-solid/30 transition-colors disabled:opacity-60"
          >
            <CheckCircle size={13} />
            {pending ? "Saving…" : "Pass QC → Ready"}
          </button>
          <button
            onClick={() => setMode("fail")}
            disabled={pending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-fault/15 border border-fault/30 text-fault text-[12px] font-medium hover:bg-fault/25 transition-colors disabled:opacity-60"
          >
            <XCircle size={13} />
            Fail QC
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-fault">{error}</p>}
    </div>
  );
}
