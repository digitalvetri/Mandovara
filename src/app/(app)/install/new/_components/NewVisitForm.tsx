"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInstallVisit } from "@/modules/install/actions";
import type { EligibleOrder } from "@/modules/install/queries";
import { CalendarDays } from "lucide-react";

interface Crew { id: string; name: string; }

interface Props {
  orders: EligibleOrder[];
  crews: Crew[];
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PROCUREMENT: "Procurement",
  MAKE: "In Make",
  READY_TO_INSTALL: "Ready to Install",
};

export function NewVisitForm({ orders, crews }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId]     = useState("");
  const [crewId, setCrewId]       = useState("");
  const [scheduledAt, setDate]    = useState("");
  const [notes, setNotes]         = useState("");

  const selectedOrder = orders.find((o) => o.id === orderId);

  function submit() {
    if (!orderId || !scheduledAt) { setError("Select an order and scheduled date"); return; }
    setError(null);
    startTransition(async () => {
      const r = await createInstallVisit({
        orderId,
        projectId: selectedOrder!.projectId,
        crewId: crewId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes.trim() || undefined,
      });
      if (r.ok && r.data) router.push(`/install/${r.data.id}`);
      else setError(r.error ?? "Failed to create visit");
    });
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
      {/* Order select */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-2 font-semibold">
          Select Order *
        </label>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrderId(o.id)}
              className={`w-full text-left flex items-start justify-between gap-3 px-3 py-2.5 rounded-md border text-[12px] transition-colors ${
                orderId === o.id
                  ? "border-gold bg-gold-tint"
                  : "border-border bg-surface-2 hover:border-gold/50"
              }`}
            >
              <div>
                <span className="font-data text-[11px] text-text-muted">{o.number}</span>
                <span className="mx-2 text-text-subtle">·</span>
                <span className="text-text font-medium">{o.clientName}</span>
                <span className="text-text-muted"> — {o.projectName}</span>
                <span className="block text-[10px] text-text-subtle mt-0.5">{o.lineCount} line(s)</span>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                o.status === "READY_TO_INSTALL" ? "bg-solid/15 text-solid" : "bg-heat/10 text-heat"
              }`}>
                {ORDER_STATUS_LABELS[o.status] ?? o.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Date & crew */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-2 font-semibold">
            Scheduled Date *
          </label>
          <div className="relative">
            <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-2 font-semibold">
            Assign Crew
          </label>
          <select
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-md border border-border bg-surface-2 text-[12px] text-text outline-none focus:border-gold"
          >
            <option value="">— Assign later —</option>
            {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-2 font-semibold">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Site access notes, special instructions…"
          className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none focus:border-gold resize-none"
        />
      </div>

      {error && <p className="text-[11px] text-fault">{error}</p>}

      <button
        onClick={submit}
        disabled={!orderId || !scheduledAt || pending}
        className="w-full h-9 rounded-md bg-gold text-ink text-[13px] font-semibold hover:bg-gold-strong transition-colors disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Installation Visit"}
      </button>
    </div>
  );
}
