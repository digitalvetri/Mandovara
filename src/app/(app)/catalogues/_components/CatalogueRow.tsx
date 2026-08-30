"use client";

import { useState, useTransition } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { deleteCatalogue } from "@/modules/catalog/catalogues-actions";
import type { CatalogueRow as Row } from "@/modules/catalog/catalogues-queries";

export function CatalogueRow({
  row,
  canDelete,
}: {
  row: Row;
  canDelete: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleDelete() {
    setError(null);
    start(async () => {
      const r = await deleteCatalogue(row.id);
      if (!r.ok) { setError(r.error ?? "Delete failed"); return; }
      setConfirmOpen(false);
    });
  }

  return (
    <li className="group flex items-center justify-between px-5 py-2.5 border-b border-rule/60 last:border-0 hover:bg-ink/10 transition-colors">
      <span className="text-[13px] text-text truncate">{row.name}</span>
      {canDelete && (
        <button
          type="button"
          onClick={() => { setError(null); setConfirmOpen(true); }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-7 w-7 grid place-items-center rounded-[6px] text-text-dim/60 hover:text-fault hover:bg-fault/8 transition-all shrink-0"
          aria-label={`Delete ${row.name}`}
          title="Delete catalogue"
        >
          <Trash2 size={12.5} strokeWidth={1.75} />
        </button>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          aria-label={`Delete ${row.name}`}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <h3 className="text-[14px] font-semibold text-text">Delete catalogue?</h3>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="h-7 w-7 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 disabled:opacity-50 transition-colors"
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-text">
                Delete <span className="font-semibold">{row.name}</span>?
              </p>
              {error && (
                <div className="rounded-[8px] border border-fault/25 bg-fault/8 p-2.5 flex gap-2 text-[12px] text-fault">
                  <AlertTriangle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
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
    </li>
  );
}
