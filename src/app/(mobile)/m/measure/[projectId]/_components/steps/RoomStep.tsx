"use client";

// Room picker — also lets the measurer add a new room inline. Big
// tap targets, list-style layout so it's fast to scroll on a phone.

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import type { FieldRoom } from "../types";
import { StepShell } from "./StepShell";

interface RoomStepProps {
  rooms:      FieldRoom[];
  selectedId: string;
  onPick:     (id: string) => void;
  onCreate:   (name: string) => Promise<void>;
}

export function RoomStep({ rooms, selectedId, onPick, onCreate }: RoomStepProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(): Promise<void> {
    if (!name.trim()) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName("");
    setCreating(false);
  }

  return (
    <StepShell title="Which room?" hint="Pick or add a room to start the first item.">
      <div className="space-y-2">
        {rooms.map((r) => {
          const active = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className={`w-full min-h-[56px] flex items-center justify-between px-4 rounded-[10px] border ${
                active ? "border-gold bg-gold-tint text-text" : "border-rule text-text hover:bg-surface-hover"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className="text-[14px] font-medium">{r.name}</span>
                {r.floorLabel && (
                  <span className="text-[10.5px] uppercase tracking-[0.05em] text-text-dim">{r.floorLabel}</span>
                )}
              </div>
              {active && <Check size={18} className="text-gold-strong" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full min-h-[56px] flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-rule text-text-dim hover:text-text hover:border-gold"
          >
            <Plus size={16} />
            Add a new room
          </button>
        ) : (
          <div className="rounded-[10px] border border-rule bg-surface p-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Living, Master bedroom, Balcony…"
              autoFocus
              className="w-full h-[48px] rounded-[8px] border border-rule bg-transparent px-3 text-[15px] text-text placeholder:text-text-faint"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => { setCreating(false); setName(""); }}
                className="flex-1 h-[44px] rounded-[8px] border border-rule text-text-dim"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={add}
                disabled={busy || !name.trim()}
                className="flex-[2] h-[44px] rounded-[8px] bg-gold text-ink font-medium disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add room"}
              </button>
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}
