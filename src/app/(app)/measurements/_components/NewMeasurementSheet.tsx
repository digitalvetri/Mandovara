"use client";

import { useState, useTransition } from "react";
import { X, Loader2, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { startMeasurementRound } from "@/modules/measurement/actions";

export interface ProjectOption { id: string; name: string; number: string }

interface Props {
  projects: ProjectOption[];
}

function defaultDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function defaultTime(): string { return "10:00"; }

export function NewMeasurementSheet({ projects }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [projectId, setProjectId] = useState("");
  const [dateVal,   setDateVal]   = useState(defaultDate);
  const [timeVal,   setTimeVal]   = useState(defaultTime);
  const [notes,     setNotes]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState("");

  const filtered = search.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.number.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  function closeAndReset() {
    setOpen(false);
    setProjectId("");
    setDateVal(defaultDate());
    setTimeVal(defaultTime());
    setNotes("");
    setSearch("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!projectId)    { setError("Select a project"); return; }
    if (!dateVal)      { setError("Visit date required"); return; }

    const visitedAt = new Date(`${dateVal}T${timeVal}`).toISOString();

    start(async () => {
      const r = await startMeasurementRound({
        projectId,
        visitedAt,
        notes: notes.trim() || undefined,
      });

      if (!r.ok) {
        setError(r.error ?? "Could not create measurement round");
        return;
      }

      if (r.needsRooms) {
        setError("This project has no rooms yet. Open the project and add rooms first.");
        return;
      }

      closeAndReset();
      router.push(`/projects/${projectId}/measurements/${r.data.id}`);
    });
  }

  const inputCls =
    "h-[36px] w-full rounded-[8px] border border-rule bg-transparent px-3 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors";
  const labelCls = "mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-text-dim";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-accent text-[12px] font-medium text-white hover:opacity-90 transition-colors"
      >
        <Ruler size={13} strokeWidth={2} />
        New measurement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={closeAndReset}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-[480px] rounded-t-[16px] sm:rounded-[16px] bg-surface border border-rule shadow-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
              <div>
                <div className="font-display text-[17px] font-semibold text-text">New measurement round</div>
                <div className="text-[11.5px] text-text-dim mt-0.5">Select a project and set the visit date</div>
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                className="rounded-full p-1 text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              {/* Project search + select */}
              <div>
                <label className={labelCls}>Project</label>
                <input
                  type="search"
                  placeholder="Search by name or number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputCls + " mb-2"}
                />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputCls + " pr-8"}
                  size={Math.min(filtered.length + 1, 6)}
                >
                  <option value="">— pick a project —</option>
                  {filtered.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number.split("/").pop()} · {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit date + time */}
              <div>
                <label className={labelCls}>Visit date &amp; time</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateVal}
                    onChange={(e) => setDateVal(e.target.value)}
                    className={inputCls + " flex-1"}
                    required
                  />
                  <input
                    type="time"
                    value={timeVal}
                    onChange={(e) => setTimeVal(e.target.value)}
                    className={inputCls + " w-[110px]"}
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes <span className="normal-case tracking-normal text-text-faint">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any site notes or special instructions..."
                  className="w-full rounded-[8px] border border-rule bg-transparent px-3 py-2 text-[12.5px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>

              {error && (
                <p className="text-[11.5px] text-fault">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-rule">
              <button
                type="button"
                onClick={closeAndReset}
                className="h-9 px-4 rounded-[8px] border border-rule text-[12px] text-text-dim hover:text-text hover:border-text-dim transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !projectId || !dateVal}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Ruler size={13} />}
                Start round
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
