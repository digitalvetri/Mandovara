"use client";

// Primary action on §5.1. Opens a lightweight inline form (visit date +
// optional notes), calls startMeasurementRound, then routes the user
// straight into the detail page for the new round so they can start
// adding items without a second click.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Loader2 } from "lucide-react";
import { startMeasurementRound } from "@/modules/measurement/actions";

interface NewRoundButtonProps {
  projectId: string;
}

export function NewRoundButton({ projectId }: NewRoundButtonProps) {
  const [open, setOpen] = useState(false);
  const [visitedAt, setVisitedAt] = useState(() => todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      const res = await startMeasurementRound({
        projectId,
        visitedAt: new Date(visitedAt),
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.needsRooms) {
        setError("This project has no rooms yet. Add at least one room from the project page before measuring.");
        return;
      }
      router.push(`/projects/${projectId}/measurements/${res.data.id}` as Route);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[6px] bg-gold px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-gold-strong transition-colors"
      >
        <Plus size={12} />
        New measurement round
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[6px] border border-rule bg-surface px-3 py-2">
      <label className="text-[11px] text-text-dim">Visited</label>
      <input
        type="date"
        value={visitedAt}
        onChange={(e) => setVisitedAt(e.target.value)}
        className="h-[28px] rounded-[4px] border border-rule bg-transparent px-2 text-[11.5px] text-text tabular"
      />
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={500}
        className="h-[28px] w-[240px] rounded-[4px] border border-rule bg-transparent px-2 text-[11.5px] text-text"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[4px] bg-gold px-3 py-1 text-[11.5px] font-medium text-ink hover:bg-gold-strong disabled:opacity-60 transition-colors"
      >
        {pending && <Loader2 size={11} className="animate-spin" />}
        Start
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="text-[11.5px] text-text-dim hover:text-text"
      >
        Cancel
      </button>
      {error && <span className="text-[10.5px] text-fault">{error}</span>}
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
