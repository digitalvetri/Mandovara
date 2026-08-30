"use client";

// One-time "Load starter list" button on the /catalogues empty state.
// Bulk-inserts the ~713 names extracted from CATALOGUE LIST.xlsx under
// the auto-managed "Catalogues" brand. Idempotent — re-clicking after a
// partial delete just re-creates what's missing.

import { useState, useTransition } from "react";
import { BookOpen, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import {
  loadCataloguesFromSeed,
  type SeedLoadResult,
} from "@/modules/catalog/catalogues-actions";
import { FAMILY_LABEL } from "@/modules/catalog/catalogues-queries";

export function LoadStarterListButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SeedLoadResult | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      const r = await loadCataloguesFromSeed();
      setResult(r);
    });
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setResult(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setResult(null); setOpen(true); }}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors"
      >
        <BookOpen size={13} strokeWidth={1.75} />
        Load starter list
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          aria-label="Load starter list"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <div className="relative w-full max-w-[520px] rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  One-time import
                </div>
                <div className="text-[14px] font-semibold text-text mt-0.5">
                  Load starter list from Excel
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="h-7 w-7 grid place-items-center rounded-[6px] text-text-dim hover:text-text hover:bg-ink/30 disabled:opacity-50 transition-colors"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!result && (
                <>
                  <p className="text-[12.5px] text-text-dim leading-relaxed">
                    Adds <strong className="text-text">713 catalogue names</strong> pulled from your
                    <code className="mx-1 rounded bg-ink/30 px-1.5 py-0.5 font-mono text-[11px] text-text">CATALOGUE LIST.xlsx</code>
                    — 8 categories, deduped inside each category. Names that already exist are skipped, so this is safe to re-run.
                  </p>
                  <ul className="text-[11.5px] text-text-dim leading-relaxed pl-4 list-disc">
                    <li>Wallpaper — 258</li>
                    <li>Curtain — main — 162</li>
                    <li>Fabric — 107</li>
                    <li>Carpets — 90</li>
                    <li>Curtain — sheer — 27</li>
                    <li>Mural / customised — 25</li>
                    <li>Wooden flooring — 25</li>
                    <li>Blinds — 19</li>
                  </ul>
                </>
              )}

              {result && result.ok && (
                <div className="rounded-[10px] border border-solid/40 bg-solid/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={15} className="text-solid" />
                    <span className="text-[13px] font-semibold text-solid">Loaded</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
                    <span className="text-text-dim">Created</span>
                    <span className="text-text tabular text-right font-medium">{result.created}</span>
                    <span className="text-text-dim">Already existed</span>
                    <span className="text-text tabular text-right">{result.skipped}</span>
                  </div>
                  <div className="pt-2 border-t border-rule text-[11px] text-text-dim">
                    <div className="mb-1">By category:</div>
                    <ul className="pl-3 space-y-0.5">
                      {result.byFamily.filter((f) => f.created > 0 || f.skipped > 0).map((f) => (
                        <li key={f.family}>
                          · {FAMILY_LABEL[f.family]}: <strong className="text-text">{f.created}</strong> new
                          {f.skipped > 0 && <>, {f.skipped} existed</>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {result && !result.ok && (
                <div className="rounded-[10px] border border-fault/40 bg-fault/5 p-3 text-[12.5px] text-fault flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>{result.error ?? "Failed to load starter list."}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-rule bg-ink/10">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="h-9 px-4 rounded-[8px] text-[13px] text-text-dim hover:text-text hover:bg-ink/20 disabled:opacity-60 transition-colors"
              >
                {result?.ok ? "Close" : "Cancel"}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={run}
                  disabled={pending}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/85 disabled:opacity-60 transition-colors"
                >
                  {pending
                    ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                    : <><BookOpen size={13} /> Load 713 names</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
