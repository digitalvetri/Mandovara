"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { scheduleDispatch } from "@/modules/orders/actions";
import type { OrderLineRow } from "@/modules/orders/queries";

interface DispatchFormProps {
  orderId:              string;
  projectId:            string;
  lines:                OrderLineRow[];
  onCancel?:            () => void;
  successRedirectPath?: string;
}

export function DispatchForm({ orderId, lines, onCancel, successRedirectPath }: DispatchFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scheduledAt, setScheduledAt]             = useState("");
  const [vehicle, setVehicle]                     = useState("");
  const [expectedDeliveryAt, setExpectedDelivery] = useState("");
  const [notes, setNotes]                         = useState("");

  // Default to the remaining (not-yet-dispatched) qty per line
  const defaultQtys = Object.fromEntries(
    lines.map((l) => [l.id, parseFloat(l.remainingQty) > 0 ? l.remainingQty : "0"]),
  );
  const [qtys, setQtys] = useState<Record<string, string>>(defaultQtys);

  // On success, either redirect or just refresh
  useEffect(() => {
    if (!done) return;
    if (successRedirectPath) {
      const t = setTimeout(() => router.push(successRedirectPath), 1400);
      return () => clearTimeout(t);
    }
    router.refresh();
  }, [done, successRedirectPath, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dispatchLines = lines
      .map((l) => ({ orderLineId: l.id, plannedQty: qtys[l.id] ?? "0", roomLabel: "" }))
      .filter((l) => parseFloat(l.plannedQty) > 0);

    if (dispatchLines.length === 0) {
      setError("Enter a quantity for at least one line.");
      return;
    }

    start(async () => {
      const res = await scheduleDispatch({
        orderId,
        scheduledAt,
        vehicle:            vehicle.trim() || undefined,
        expectedDeliveryAt: expectedDeliveryAt || undefined,
        notes:              notes.trim() || undefined,
        lines:              dispatchLines,
      });
      if (!res.ok) { setError(res.error ?? "Failed to schedule dispatch."); return; }
      setDone(true);
    });
  }

  const fc = "w-full h-[34px] px-2.5 bg-surface-hover border border-rule rounded-[6px] text-[12.5px] text-text outline-none focus:border-accent";

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <CheckCircle2 size={28} className="text-solid" />
        <p className="text-[13px] font-medium text-text">Dispatch scheduled</p>
        <p className="text-[12px] text-text-muted">The install visit has been created.</p>
        {successRedirectPath && (
          <p className="text-[11px] text-text-subtle mt-1">Redirecting…</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-muted mb-1">
            Dispatch Date &amp; Time <span className="text-fault">*</span>
          </label>
          <input
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={fc}
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-muted mb-1">
            Expected Delivery
          </label>
          <input
            type="date"
            value={expectedDeliveryAt}
            onChange={(e) => setExpectedDelivery(e.target.value)}
            className={fc}
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-muted mb-1">
            Vehicle / Van No.
          </label>
          <input
            type="text"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="TN 38 AB 1234"
            className={fc}
          />
        </div>
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-muted mb-1">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional instructions"
            className={fc}
          />
        </div>
      </div>

      <div>
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-muted mb-2">
          Items to Dispatch
        </div>
        <div className="divide-y divide-rule/60 rounded-[8px] border border-rule overflow-hidden">
          {lines.map((l) => {
            const remaining = parseFloat(l.remainingQty);
            const dispatched = parseFloat(l.dispatchedQty);
            return (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2 bg-surface">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-text truncate">{l.description}</div>
                  <div className="text-[10.5px] text-text-muted tabular-nums">
                    Ordered: {l.quantity} {l.unit}
                    {dispatched > 0 && (
                      <> · Dispatched: <span className="text-heat">{l.dispatchedQty}</span></>
                    )}
                    {" · "}Remaining: <span className={remaining === 0 ? "text-fault" : "text-solid"}>{l.remainingQty}</span>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={remaining}
                  step="0.01"
                  value={qtys[l.id] ?? ""}
                  onChange={(e) => setQtys((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  placeholder="0"
                  disabled={remaining === 0}
                  className="w-[80px] h-[30px] px-2 bg-surface-hover border border-rule rounded-[6px] text-[12px] text-text text-right tabular-nums outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-fault">{error}</div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-[32px] px-4 rounded-[6px] text-[12px] text-text-muted border border-rule hover:bg-surface-hover disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-[32px] px-4 rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60 transition-colors"
          style={{ background: "var(--color-gold)", color: "var(--color-ink)" }}
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          Schedule Dispatch
        </button>
      </div>
    </form>
  );
}
