"use client";

// Modal sheet that opens when Start Measurement fires and the project
// has no rooms yet (spec §4 rule 2). Add rooms one-by-one; each is
// created immediately via the createRoom action. When the user is done,
// they hit Continue and we re-invoke the start-measurement flow.
//
// Deliberately compact — floor is optional, only name is required. The
// spec says "you cannot measure without rooms" but doesn't ask us to
// front-load a whole floor plan.

import { useState, useTransition } from "react";
import { X, Plus, Loader2, Check } from "lucide-react";
import { createRoom } from "@/modules/measurement/actions";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function RoomSetupSheet({ projectId, open, onClose, onDone }: Props) {
  const [rooms, setRooms] = useState<{ name: string; floor: string }[]>([{ name: "", floor: "" }]);
  const [added, setAdded] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function updateRow(idx: number, patch: { name?: string; floor?: string }): void {
    setRooms((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function addRow(): void {
    setRooms((rs) => [...rs, { name: "", floor: "" }]);
  }

  function submit(): void {
    setError(null);
    const filled = rooms.map((r) => ({ name: r.name.trim(), floor: r.floor.trim() }))
                        .filter((r) => r.name.length > 0);
    if (filled.length === 0) {
      setError("Add at least one room to continue.");
      return;
    }
    start(async () => {
      let ok = 0;
      for (const r of filled) {
        const res = await createRoom({
          projectId,
          name: r.name,
          floorLabel: r.floor || undefined,
        });
        if (!res.ok) {
          setError(res.error ?? "Could not create a room");
          setAdded(ok);
          return;
        }
        ok += 1;
        setAdded(ok);
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add rooms"
    >
      <div className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface p-6 shadow-xl">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-display text-[20px] font-semibold text-text">Add rooms</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-text-dim">
          A measurement round needs rooms to attach items to. Add at least one — you can add more later.
        </p>

        <div className="space-y-2">
          {rooms.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={r.name}
                placeholder="Room name (e.g. Master Bedroom)"
                onChange={(e) => updateRow(i, { name: e.target.value })}
                className="h-10 flex-1 rounded-[8px] border border-rule bg-surface-2 px-3 text-[13px] text-text outline-none focus:border-gold"
                autoFocus={i === 0}
                maxLength={80}
              />
              <input
                type="text"
                value={r.floor}
                placeholder="Floor (optional)"
                onChange={(e) => updateRow(i, { floor: e.target.value })}
                className="h-10 w-[130px] rounded-[8px] border border-rule bg-surface-2 px-3 text-[12.5px] text-text-dim outline-none focus:border-gold"
                maxLength={40}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-text-dim hover:text-text"
        >
          <Plus size={12} />
          Add another room
        </button>

        {error && (
          <div className="mt-3 rounded-[8px] border border-fault/40 bg-fault/5 px-3 py-2 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        {pending && added > 0 && (
          <div className="mt-3 text-[11.5px] text-text-dim">
            <Check size={11} className="inline text-solid" /> {added} added…
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-[8px] px-4 py-2 text-[12.5px] text-text-dim hover:text-text disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[8px] bg-gold px-5 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? <Loader2 size={12} className="animate-spin" />
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
