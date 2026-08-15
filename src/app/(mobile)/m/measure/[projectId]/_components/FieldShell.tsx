"use client";

// Top-level PWA shell. Owns the round-vs-start state, room list
// (kept fresh through the createRoom action), and the outbox drain
// listener. The one-item-per-screen flow itself lives in ItemFlow.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Ruler } from "lucide-react";
import { startMeasurementRound, createRoom } from "@/modules/measurement/actions";
import { attachDrainListeners, type DrainSummary } from "@/lib/measure-drain";
import type { FieldProject, FieldRoom, ResumableRound } from "./types";
import { QueueBanner } from "./QueueBanner";
import { ItemScreen } from "./ItemScreen";

interface FieldShellProps {
  project:        FieldProject;
  rooms:          FieldRoom[];
  resumableRound: ResumableRound | null;
}

export function FieldShell({ project, rooms: roomsIn, resumableRound }: FieldShellProps) {
  const router = useRouter();
  const [round, setRound]   = useState<ResumableRound | null>(resumableRound);
  const [rooms, setRooms]   = useState<FieldRoom[]>(roomsIn);
  const [starting, startStarting] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [drain, setDrain]   = useState<DrainSummary | null>(null);

  // Wire outbox drain — reruns on visibility change and when the
  // device reports online again. The drain also runs once on mount.
  useEffect(() => {
    const dispose = attachDrainListeners(project.id, (s) => {
      setDrain(s);
      if (s.sent > 0) {
        // A successful sync means the server saw new items; refresh
        // any linked office surfaces (the caller may have the round
        // detail open in another tab).
        router.refresh();
      }
    });
    return dispose;
  }, [project.id, router]);

  function beginRound(): void {
    setError(null);
    startStarting(async () => {
      const res = await startMeasurementRound({
        projectId: project.id,
        visitedAt: new Date(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.needsRooms) {
        setError("Add at least one room before starting a round.");
        return;
      }
      setRound({
        id:        res.data.id,
        number:    res.data.number,
        visitedAt: new Date(),
        itemCount: 0,
      });
    });
  }

  async function addRoom(name: string): Promise<FieldRoom | null> {
    const res = await createRoom({ projectId: project.id, name });
    if (!res.ok || !res.data) {
      setError(res.error ?? "Could not create room");
      return null;
    }
    const created: FieldRoom = {
      id:         res.data.id,
      name,
      floorLabel: null,
      sortOrder:  (rooms[rooms.length - 1]?.sortOrder ?? 0) + 10,
    };
    setRooms((r) => [...r, created]);
    return created;
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col text-text">
      {/* Header — thin, one line, back arrow + progress count */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-surface border-b border-rule px-3 py-2.5">
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}/measurements` as `/projects/${string}/measurements`)}
          className="h-11 w-11 grid place-items-center rounded-[8px] hover:bg-surface-hover"
          aria-label="Back to project"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center leading-tight">
          <div className="text-[11px] uppercase tracking-[0.08em] text-text-dim">
            {project.number}
          </div>
          <div className="text-[13px] font-medium truncate max-w-[220px]">
            {project.clientName}
          </div>
        </div>
        <div className="w-11" aria-hidden />
      </header>

      {error && (
        <div className="mx-3 mt-3 rounded-[6px] border border-fault/40 bg-fault/10 px-3 py-2 text-[12px] text-fault">
          {error}
        </div>
      )}

      {round ? (
        <ItemScreen
          projectId={project.id}
          measurementId={round.id}
          rooms={rooms}
          initialItemCount={round.itemCount}
          onRoomAdded={addRoom}
        />
      ) : (
        <StartCard project={project} pending={starting} onStart={beginRound} />
      )}

      <QueueBanner projectId={project.id} drain={drain} />
    </div>
  );
}

function StartCard({
  project, pending, onStart,
}: { project: FieldProject; pending: boolean; onStart: () => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 pt-16 text-center">
      <div className="h-14 w-14 rounded-full bg-gold-tint grid place-items-center mb-4">
        <Ruler size={26} className="text-gold-strong" />
      </div>
      <h1 className="text-[22px] font-medium mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
        Ready to measure
      </h1>
      <p className="text-[13px] text-text-dim max-w-[260px] mb-8">
        {project.name}. A round captures everything from this visit;
        add items one at a time. Works offline.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="min-h-[56px] w-full max-w-[320px] rounded-[10px] bg-gold text-ink text-[15px] font-medium hover:bg-gold-strong disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
      >
        {pending && <Loader2 size={18} className="animate-spin" />}
        Start round
      </button>
    </main>
  );
}
