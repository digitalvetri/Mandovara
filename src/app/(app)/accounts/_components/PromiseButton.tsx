"use client";

// Click "Promised" on a chase row → opens a lightweight popover with a
// date picker + optional note, submits to recordPromise. Suppresses the
// client from the chase list until the promised date.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { recordPromise } from "@/modules/accounts/chase-actions";

interface Props {
  clientId:   string;
  clientName: string;
  children:   React.ReactNode;   // the trigger button (rendered by the parent)
}

/** Default "next Tuesday" style helper — turns "in 7 days" into a yyyy-mm-dd. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function PromiseButton({ clientId, clientName, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => daysFromNow(3));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onSave() {
    setError(null);
    start(async () => {
      const r = await recordPromise({ clientId, promisedDate: date, note: note.trim() || undefined });
      if (!r.ok) { setError(r.error ?? "Could not save"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        {children}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-30 w-72 rounded-[10px] border border-rule bg-surface shadow-xl p-4">
          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-0.5">Promise to pay</div>
            <div className="text-[12px] text-text truncate">{clientName}</div>
          </div>

          <label className="block text-[11px] font-medium text-text-dim mb-1">When will they pay?</label>
          <input
            type="date"
            value={date}
            min={daysFromNow(0)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text tabular-nums outline-none focus:border-gold"
          />

          <div className="flex gap-1.5 mt-2">
            <QuickBtn label="+3d"  onClick={() => setDate(daysFromNow(3))} />
            <QuickBtn label="+7d"  onClick={() => setDate(daysFromNow(7))} />
            <QuickBtn label="+14d" onClick={() => setDate(daysFromNow(14))} />
          </div>

          <label className="block text-[11px] font-medium text-text-dim mt-3 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. after their loan disbursement"
            maxLength={500}
            className="w-full h-9 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] text-text outline-none focus:border-gold"
          />

          {error && (
            <div className="mt-2 rounded-[6px] border border-fault/40 bg-fault/5 px-2.5 py-1.5 text-[11px] text-fault">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-1.5 mt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-3 rounded-[8px] text-[12px] text-text-dim hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="h-9 px-3.5 rounded-[8px] bg-gold text-ink text-[12px] font-semibold hover:bg-gold-strong disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
            >
              {pending && <Loader2 size={12} className="animate-spin" />}
              Save promise
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 h-7 rounded-[6px] border border-rule text-[11px] text-text-dim hover:text-text hover:border-text-dim transition-colors"
    >
      {label}
    </button>
  );
}
