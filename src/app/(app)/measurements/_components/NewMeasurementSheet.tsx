"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X, Loader2, Ruler, ChevronDown, Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { startMeasurementRound } from "@/modules/measurement/actions";

export interface ProjectOption { id: string; name: string; number: string }

interface Props { projects: ProjectOption[] }

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export function NewMeasurementSheet({ projects }: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [pending, start]      = useTransition();

  const [projectId,   setProjectId]   = useState("");
  const [projectName, setProjectName] = useState("");
  const [dateVal,     setDateVal]     = useState(todayISO);
  const [timeVal,     setTimeVal]     = useState("10:00");
  const [notes,       setNotes]       = useState("");
  const [error,       setError]       = useState<string | null>(null);

  // Combobox state
  const [dropOpen,  setDropOpen]  = useState(false);
  const [query,     setQuery]     = useState("");
  const dropRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.number.toLowerCase().includes(query.toLowerCase()),
      )
    : projects;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (dropOpen) setTimeout(() => searchRef.current?.focus(), 40);
  }, [dropOpen]);

  function selectProject(p: ProjectOption) {
    setProjectId(p.id);
    setProjectName(`${p.number.split("/").pop()} · ${p.name}`);
    setDropOpen(false);
    setQuery("");
    setError(null);
  }

  function closeAndReset() {
    setOpen(false);
    setProjectId(""); setProjectName(""); setDateVal(todayISO()); setTimeVal("10:00");
    setNotes(""); setQuery(""); setError(null); setDropOpen(false);
  }

  function submit() {
    setError(null);
    if (!projectId) { setError("Select a project first"); return; }
    if (!dateVal)   { setError("Visit date required"); return; }
    const visitedAt = new Date(`${dateVal}T${timeVal}`).toISOString();
    start(async () => {
      const r = await startMeasurementRound({ projectId, visitedAt, notes: notes.trim() || undefined });
      if (!r.ok)        { setError(r.error ?? "Could not create measurement round"); return; }
      if (r.needsRooms) { setError("This project has no rooms yet — open the project and add rooms first."); return; }
      closeAndReset();
      router.push(`/projects/${projectId}/measurements/${r.data.id}`);
    });
  }

  const inputCls = "h-[38px] w-full rounded-[8px] border border-rule bg-transparent px-3 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors";

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 transition-colors"
      >
        <Ruler size={13} strokeWidth={2} />
        New measurement
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[3px]" onClick={closeAndReset} />

          {/* Sheet */}
          <div className="relative z-10 w-full max-w-[440px] rounded-[18px] bg-surface border border-rule shadow-lg overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div>
                <h2 className="font-display text-[19px] font-semibold text-text leading-snug">
                  New measurement round
                </h2>
                <p className="mt-0.5 text-[12px] text-text-dim">
                  Choose a project, set the visit date and start recording.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                className="mt-0.5 shrink-0 rounded-full p-1.5 text-text-dim hover:bg-surface-2 hover:text-text transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="h-px bg-rule" />

            {/* Body */}
            <div className="px-6 py-5 space-y-5">

              {/* Project combobox */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-dim">
                  Project
                </label>
                <div ref={dropRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropOpen((v) => !v)}
                    className={[
                      "flex w-full items-center justify-between gap-2 rounded-[8px] border px-3 h-[38px] text-[13px] transition-colors",
                      projectId
                        ? "border-rule text-text"
                        : "border-rule text-text-faint",
                      dropOpen ? "border-accent" : "hover:border-text-dim",
                    ].join(" ")}
                  >
                    <span className="truncate">
                      {projectName || "Select a project…"}
                    </span>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      className={`shrink-0 text-text-dim transition-transform ${dropOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {dropOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-[10px] border border-rule bg-surface shadow-md overflow-hidden">
                      {/* Search inside dropdown */}
                      <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                        <Search size={12} className="shrink-0 text-text-dim" />
                        <input
                          ref={searchRef}
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search projects…"
                          className="flex-1 bg-transparent text-[12.5px] text-text placeholder:text-text-faint focus:outline-none"
                        />
                      </div>
                      {/* List */}
                      <ul className="max-h-[200px] overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                          <li className="px-3 py-3 text-[12px] text-text-dim text-center">No projects match</li>
                        ) : (
                          filtered.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => selectProject(p)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                              >
                                <span className="tabular text-[11px] text-text-dim shrink-0 w-[80px] truncate">
                                  {p.number.split("/").pop()}
                                </span>
                                <span className="flex-1 truncate text-[12.5px] text-text">{p.name}</span>
                                {projectId === p.id && (
                                  <Check size={12} className="shrink-0 text-accent" />
                                )}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Visit date & time */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-dim">
                  Visit date &amp; time
                </label>
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
                    className={inputCls + " w-[108px]"}
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-dim">
                  Notes
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-text-faint">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any site-specific notes or instructions…"
                  className="w-full rounded-[8px] border border-rule bg-transparent px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>

              {error && (
                <p className="rounded-[8px] bg-fault/8 border border-fault/20 px-3 py-2 text-[12px] text-fault">
                  {error}
                </p>
              )}
            </div>

            <div className="h-px bg-rule" />

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4">
              <button
                type="button"
                onClick={closeAndReset}
                className="h-9 px-4 rounded-[8px] border border-rule text-[12.5px] text-text-dim hover:text-text hover:border-text-dim transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !projectId || !dateVal}
                className="inline-flex items-center gap-1.5 h-9 px-5 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {pending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Ruler size={13} strokeWidth={2} />}
                Start round
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
