"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { addMilestone, setMilestoneStatus } from "@/modules/projects/actions";
import type { ProjectMilestone } from "@/modules/projects/queries";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

export function Milestones({ projectId, milestones }: { projectId: string; milestones: ProjectMilestone[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plannedDate, setPlannedDate] = useState(iso(new Date()));
  const [billingPct, setBillingPct] = useState("25");
  const [error, setError] = useState<string | null>(null);

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addMilestone({ projectId, name, plannedDate, billingPct: Number(billingPct) });
      if (!res.ok) { setError(res.error ?? "Could not add milestone"); return; }
      setName(""); setBillingPct("25"); setOpen(false);
      router.refresh();
    });
  }

  function complete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await setMilestoneStatus({ id, status: "COMPLETED" });
      if (!res.ok) { setError(res.error ?? "Could not complete"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Milestones ({milestones.length})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add milestone
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule flex items-end gap-2">
          <div className="flex-1">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Planned</div>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)}
                   className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
          </div>
          <div className="w-[80px]">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Billing %</div>
            <input value={billingPct} onChange={(e) => setBillingPct(e.target.value)}
                   className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={pending || !name}
                  className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
            Add
          </button>
        </form>
      )}
      {error && (
        <div className="px-4 py-2 text-[11.5px] text-bad bg-bad/6 border-b border-bad/20">{error}</div>
      )}
      {milestones.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No milestones yet.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {milestones.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="tabular text-[11px] text-text-dim w-[24px]">{m.order}.</div>
              <div className="flex-1">
                <div className={m.status === "COMPLETED" ? "text-[12.5px] text-text-dim line-through" : "text-[12.5px] text-text"}>{m.name}</div>
                <div className="text-[10.5px] text-text-dim tabular">
                  Planned {fmt(m.plannedDate)}
                  {m.actualDate && <span className="text-good"> · done {fmt(m.actualDate)}</span>}
                </div>
              </div>
              <div className="text-[10.5px] text-text-dim tabular w-[60px] text-right">{m.billingPct}%</div>
              {m.status !== "COMPLETED" && (
                <button type="button" onClick={() => complete(m.id)} disabled={pending}
                        className="inline-flex items-center gap-1 h-[26px] px-2 rounded-[4px] text-[11px] bg-good/12 text-good hover:bg-good/20 transition-colors disabled:opacity-60">
                  <Check size={11} /> Complete
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
