"use client";

// The installation checklist, grouped by room.
//
// This is what an installer reads on site and what the owner scans to
// answer "is the master bedroom done?". Rooms, not stages — a project is
// never uniformly at one point, and pretending otherwise was the thing
// that made the old flow frustrating.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { setLineInstalled } from "@/modules/projects/actions-installation";
import type { ProjectInstallation } from "@/modules/projects/queries-installation";

export function InstallationPanel({
  data, projectId, canEdit,
}: { data: ProjectInstallation; projectId: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data.groups.length === 0) {
    return (
      <div className="py-6 text-center text-[12.5px] text-text-dim">
        Nothing to install yet. Once the quotation is accepted and an order is
        created, every item appears here grouped by room.
      </div>
    );
  }

  function toggle(lineId: string, done: boolean): void {
    if (!canEdit) return;
    setError(null);
    setBusyId(lineId);
    start(async () => {
      const res = await setLineInstalled({
        orderLineId:  lineId,
        projectId,
        installedQty: done ? 0 : null,
      });
      setBusyId(null);
      if (!res.ok) { setError(res.error ?? "Could not update that line"); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-good transition-all"
            style={{ width: `${data.pct}%` }}
          />
        </div>
        <span className="tabular shrink-0 text-[12px] text-text-dim">
          {data.doneLines} of {data.totalLines} done
        </span>
      </div>

      {data.groups.map((g) => (
        <div key={g.room} className="overflow-hidden rounded-[10px] border border-rule">
          <div className="flex items-center justify-between gap-2 border-b border-rule bg-surface-2 px-3.5 py-2">
            <span className="text-[12px] font-medium text-text">{g.room}</span>
            <span
              className={
                "tabular shrink-0 text-[11px] " +
                (g.doneCount === g.lines.length ? "text-good" : "text-text-dim")
              }
            >
              {g.doneCount === g.lines.length
                ? "Complete"
                : `${g.doneCount}/${g.lines.length}`}
            </span>
          </div>
          <ul className="divide-y divide-rule/60">
            {g.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <button
                  type="button"
                  disabled={!canEdit || pending}
                  onClick={() => toggle(l.id, l.done)}
                  aria-label={l.done ? `Mark ${l.description} not installed` : `Mark ${l.description} installed`}
                  aria-pressed={l.done}
                  className={
                    "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border transition-colors " +
                    (l.done
                      ? "border-good bg-good text-white"
                      : "border-rule bg-transparent hover:border-good") +
                    (canEdit ? " cursor-pointer" : " cursor-default opacity-60")
                  }
                >
                  {busyId === l.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : l.done ? <Check size={11} strokeWidth={3} /> : null}
                </button>
                <span className={`min-w-0 flex-1 text-[12.5px] ${l.done ? "text-text-dim line-through" : "text-text"}`}>
                  {l.description}
                </span>
                <span className="tabular shrink-0 text-[11.5px] text-text-dim">
                  {l.installedQty} / {l.quantity} {l.unit.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {error && <div className="text-[11.5px] text-bad">{error}</div>}
    </div>
  );
}
