"use client";

import { useMemo } from "react";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import type { MeasurementItemRow } from "@/modules/measurement/queries";
import {
  familyLabel, wallpaperInputsFrom, flooringInputsFrom, curtainInputsFrom,
} from "./measurement-types";

function summariseInputs(m: MeasurementItemRow): string {
  if (m.family === "WALLPAPER") {
    const i = wallpaperInputsFrom(m.inputs);
    return `${i.wallWidthMm}×${i.wallHeightMm} · ${i.patternMatch}`;
  }
  if (m.family === "FLOORING") {
    const i = flooringInputsFrom(m.inputs);
    return `${i.roomLengthMm}×${i.roomWidthMm} · ${i.layPattern} · ${i.productKind}`;
  }
  const i = curtainInputsFrom(m.inputs);
  return `${i.windowWidthMm}×${i.windowHeightMm} · ${i.fullness}× fullness`;
}

export function ItemsList({
  items, onEdit, onDelete, editingId,
}: {
  items: MeasurementItemRow[];
  onEdit: (m: MeasurementItemRow) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
}) {
  const byRoom = useMemo(() => {
    const map = new Map<string, MeasurementItemRow[]>();
    for (const m of items) {
      const list = map.get(m.roomLabel) ?? [];
      list.push(m);
      map.set(m.roomLabel, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No measurements yet.</div>
        <p className="text-[12px] text-text-dim">
          Fill the form on the left and press <span className="text-text">Add measurement</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byRoom.map(([room, rows]) => (
        <div key={room} className="rounded-[14px] bg-surface border border-rule">
          <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">{room}</div>
            <div className="text-[10.5px] text-text-faint tabular">{rows.length} item{rows.length !== 1 ? "s" : ""}</div>
          </div>
          <ul className="divide-y divide-rule/60">
            {rows.map((m) => (
              <li key={m.id} className={`px-4 py-3 flex items-start gap-3 ${editingId === m.id ? "bg-accent/6" : ""}`}>
                <div className="h-[42px] w-[42px] rounded-[6px] border border-dashed border-rule flex items-center justify-center text-text-faint shrink-0">
                  <ImagePlus size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-text truncate">{m.label}</div>
                  <div className="text-[10.5px] text-text-dim tabular flex items-center gap-2 mt-0.5">
                    <span className="uppercase tracking-[0.08em] text-text-faint">{familyLabel(m.family)}</span>
                    <span>·</span>
                    <span>{summariseInputs(m)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => onEdit(m)}
                        className="h-[26px] w-[26px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-text hover:bg-surface-hover">
                  <Pencil size={12} />
                </button>
                <button type="button" onClick={() => onDelete(m.id)}
                        className="h-[26px] w-[26px] grid place-items-center rounded-[6px] border border-rule text-text-dim hover:text-bad hover:bg-bad/8">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
