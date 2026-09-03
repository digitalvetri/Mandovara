"use client";

// Change a quotation's status by hand.
//
// Why this exists (owner, 2026-09-04): the only status control on the
// page was "Send", so a quotation that had been invoiced and paid still
// read "Draft" months later. There was no way to say so — the transition
// table allowed two moves and the UI offered one of them.
//
// It sits next to the StatusPill and opens a list of the states
// reachable from the current one, each with a line saying what it means.
// The list comes from modules/quotations/transitions.ts, which is the
// same map the server enforces, so nothing is offered that would be
// refused — and anything the user's role can't do is filtered out
// before it is drawn. The server still checks; this only saves a click
// that was going to fail.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { setQuotationStatus } from "@/modules/quotations/actions-part2";
import {
  allowedStatusTargets, QUOTATION_STATUS_LABEL, QUOTATION_STATUS_HINT,
} from "@/modules/quotations/transitions";

interface Props {
  id:          string;
  current:     string;
  /** The viewer's permission keys — used only to hide moves they can't make. */
  permissions: string[];
}

export function StatusMenu({ id, current, permissions }: Props) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const targets = allowedStatusTargets(current, permissions);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing this user can move it to — say nothing rather than show a
  // dead control.
  if (targets.length === 0) return null;

  function move(target: string): void {
    setError(null);
    start(async () => {
      const res = await setQuotationStatus({ id, status: target });
      if (!res.ok) { setError(res.error ?? "Could not change the status"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={pending}
        onClick={() => { setError(null); setOpen((v) => !v); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] border border-rule px-3 text-[11.5px] font-medium text-text-dim transition-colors hover:border-gold hover:text-text disabled:opacity-60"
      >
        {pending && <Loader2 size={11} className="animate-spin" />}
        Change status
        <ChevronDown size={11} strokeWidth={2} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[248px] overflow-hidden rounded-[10px] border border-rule bg-surface p-1 shadow-xl"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-[10px] uppercase tracking-[0.14em] text-text-subtle">
            Currently {QUOTATION_STATUS_LABEL[current] ?? current}
          </div>

          {targets.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => move(t)}
              className="flex w-full items-start gap-2 rounded-[7px] px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <Check size={11} className="mt-[3px] shrink-0 opacity-0" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[12.5px] text-text">
                  {QUOTATION_STATUS_LABEL[t] ?? t}
                </span>
                <span className="block text-[10.5px] leading-snug text-text-dim">
                  {QUOTATION_STATUS_HINT[t] ?? ""}
                </span>
              </span>
            </button>
          ))}

          {error && (
            <div className="m-1 rounded-[7px] border border-fault/40 bg-fault/5 px-2.5 py-1.5 text-[10.5px] leading-snug text-fault">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
