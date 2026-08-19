"use client";

// REQ-06 — "Start Measurement" entry point from the client 360 page.
// Handles the 0 / 1 / 2+ projects cases and drives the room-setup sheet.
// Uses the same server action (startMeasurementAndRedirect) that powers
// the project-detail NextActionCard, so all the device-aware redirect
// and room-guard logic is shared.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Ruler, Loader2, X } from "lucide-react";
import { startMeasurementAndRedirect } from "@/modules/measurement/start-and-redirect";
import { RoomSetupSheet } from "@/app/(app)/projects/_components/RoomSetupSheet";

interface ProjectOption {
  id:    string;
  name:  string;
  stage: string;
}

interface Props {
  clientId:    string;
  projects:    ProjectOption[];
  canMeasure:  boolean;
}

export function StartMeasurementFromClientButton({ clientId, projects, canMeasure }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [needsRoomsProjectId, setNeedsRoomsProjectId] = useState<string | null>(null);

  function handleStart(projectId: string): void {
    setError(null);
    setPickerOpen(false);
    start(async () => {
      try {
        const res = await startMeasurementAndRedirect({ projectId });
        if (res?.needsRooms) setNeedsRoomsProjectId(projectId);
      } catch (e: unknown) {
        const err = e as { digest?: string; message?: string };
        if (err?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError(err?.message ?? "Could not start measurement");
      }
    });
  }

  function fire(): void {
    if (!canMeasure) return;
    if (projects.length === 0) {
      router.push(`/projects/new?client=${clientId}` as Route);
      return;
    }
    if (projects.length === 1) {
      handleStart(projects[0]!.id);
      return;
    }
    setPickerOpen(true);
  }

  const buttonLabel = projects.length === 0
    ? "Create project first"
    : "Start measurement";

  if (!canMeasure) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-[8px] border border-rule px-3 py-1.5 text-[12px] text-text-dim opacity-60 cursor-not-allowed">
        <Ruler size={13} />
        Start measurement
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={fire}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[8px] bg-gold px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-gold-strong disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {pending
          ? <Loader2 size={13} className="animate-spin" />
          : <Ruler size={13} />}
        {pending ? "Starting…" : buttonLabel}
      </button>

      {error && (
        <div className="absolute mt-1 rounded-[8px] border border-fault/40 bg-surface px-3 py-2 text-[11.5px] text-fault shadow-lg z-10">
          {error}
        </div>
      )}

      {/* Project picker — shown when 2+ projects */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a project to measure"
        >
          <div className="w-full max-w-[440px] rounded-[14px] border border-rule bg-surface p-6 shadow-xl">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-display text-[18px] font-semibold text-text">
                Which project?
              </h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-[6px] p-1 text-text-dim hover:bg-surface-2 hover:text-text"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-[12.5px] text-text-dim">
              Select the project you&apos;re visiting today.
            </p>
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedProjectId(p.id); handleStart(p.id); }}
                  disabled={pending && selectedProjectId === p.id}
                  className="w-full rounded-[10px] border border-rule bg-surface-2 px-4 py-3 text-left hover:border-gold hover:bg-surface transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-text truncate">{p.name}</span>
                    <span className="text-[10.5px] uppercase tracking-[0.06em] text-text-dim shrink-0">
                      {p.stage.replace(/_/g, " ")}
                    </span>
                  </div>
                  {pending && selectedProjectId === p.id && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gold">
                      <Loader2 size={10} className="animate-spin" />
                      Starting…
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Room-setup sheet — fires when the chosen project has no rooms */}
      {needsRoomsProjectId && (
        <RoomSetupSheet
          projectId={needsRoomsProjectId}
          open={true}
          onClose={() => setNeedsRoomsProjectId(null)}
          onDone={() => {
            const pid = needsRoomsProjectId;
            setNeedsRoomsProjectId(null);
            handleStart(pid);
          }}
        />
      )}
    </>
  );
}
