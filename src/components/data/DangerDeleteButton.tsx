"use client";

// Shared delete-confirm dialog. Used by lead/client detail pages so both
// have identical UX. The caller passes the async delete function and a
// destination for navigation after success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Trash2, X, AlertTriangle } from "lucide-react";

interface Props {
  entityLabel:  string;   // e.g. "lead", "client"
  entityName:   string;   // e.g. "Dr Kannan" — displayed in the dialog
  onDelete:     () => Promise<{ ok: boolean; error?: string }>;
  redirectTo:   string;   // e.g. "/leads", "/clients"
  extraWarning?: string;  // extra context shown in the dialog
}

export function DangerDeleteButton({ entityLabel, entityName, onDelete, redirectTo, extraWarning }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  function handleDelete() {
    setError(null);
    start(async () => {
      const res = await onDelete();
      if (!res.ok) { setError(res.error ?? "Delete failed"); return; }
      setOpen(false);
      router.push(redirectTo as Route);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-fault/30 bg-fault/5 px-3 py-1.5 text-[12px] font-medium text-fault hover:border-fault/60 hover:bg-fault/10 transition-colors"
        aria-label={`Delete ${entityLabel} ${entityName}`}
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Delete {entityLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={`Delete ${entityName}`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <h3 className="text-[14px] font-semibold text-text">Delete {entityLabel}?</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="h-7 w-7 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 disabled:opacity-50 transition-colors"
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-text">
                Delete <span className="font-semibold">{entityName}</span>? This cannot be undone.
              </p>
              {extraWarning && (
                <div className="rounded-[8px] border border-fault/25 bg-fault/8 p-3 flex gap-2.5">
                  <AlertTriangle size={15} strokeWidth={1.75} className="text-fault mt-0.5 shrink-0" />
                  <div className="text-[12px] text-text-dim">{extraWarning}</div>
                </div>
              )}
              {error && <p className="text-[12px] text-fault">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="h-8 px-4 rounded-[7px] text-[12px] text-text-dim border border-rule hover:bg-ink/20 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={pending}
                  className="h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-fault text-white hover:bg-fault/85 disabled:opacity-60 transition-colors"
                >
                  {pending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
