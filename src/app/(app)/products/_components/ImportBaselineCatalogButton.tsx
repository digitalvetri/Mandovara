"use client";

// One-click catalog seeder — pushes the 687 rows extracted from the
// owner's WALLAPPER STOCK LIST catalog sheets into Brand / Collection /
// Design / Colourway / Price. No stock quantities involved; that's a
// separate button on /inventory.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, X, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  importBaselineCatalog,
  type ImportBaselineCatalogResult,
} from "@/modules/catalog/actions-import";

export function ImportBaselineCatalogButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportBaselineCatalogResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fire() {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const r = await importBaselineCatalog();
        setResult(r);
        if (r.ok) router.refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(null); setError(null); }}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors"
      >
        <BookOpen size={13} strokeWidth={1.75} />
        Load catalog
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Load baseline catalog"
        >
          <div className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  Baseline catalog import
                </div>
                <div className="text-[14px] font-semibold text-text mt-0.5">
                  Load catalogue names from your Excel
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-full text-text-dim hover:text-text hover:bg-surface-hover"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!result && !error && (
                <>
                  <p className="text-[12.5px] text-text-dim leading-relaxed">
                    Imports the nine catalog sheets in
                    <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
                      WALLAPPER STOCK LIST.xlsx
                    </code>
                    (Wallpaper · Curtain Main · Curtain Sheer · Fabric ·
                    Wooden Flooring · Carpets · Blinds · etc.) into the
                    catalog under brand <strong className="text-text">Mandovara Studio</strong>.
                    Each catalogue name becomes a Design + Standard colourway
                    + RETAIL price.
                  </p>
                  <p className="text-[12px] text-text-faint leading-relaxed">
                    Safe to re-run — existing designs / colourways are left
                    alone, only missing rows are created. Prices with a live
                    RETAIL tier are also preserved.
                  </p>
                  <p className="text-[11.5px] text-text-faint">
                    If your Excel changed, re-run
                    <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-text">
                      pnpm tsx scripts/extract-catalog.ts
                    </code>
                    first, then click Import.
                  </p>
                </>
              )}

              {result && result.ok && (
                <div className="rounded-[10px] border border-good/30 bg-good/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={15} className="text-good" />
                    <span className="text-[13px] font-semibold text-good">Import complete</span>
                  </div>
                  <ResultGrid r={result} />
                </div>
              )}

              {result && !result.ok && (
                <div className="rounded-[10px] border border-heat/30 bg-heat/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={15} className="text-heat" />
                    <span className="text-[13px] font-semibold text-heat">
                      Imported with {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ResultGrid r={result} />
                  <ul className="mt-3 max-h-[160px] overflow-y-auto space-y-1 text-[11px] font-mono text-fault">
                    {result.errors.slice(0, 30).map((e, i) => (
                      <li key={i}>· {e}</li>
                    ))}
                    {result.errors.length > 30 && (
                      <li className="text-text-dim">… +{result.errors.length - 30} more</li>
                    )}
                  </ul>
                </div>
              )}

              {error && (
                <div className="rounded-[10px] border border-fault/30 bg-fault/8 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} className="text-fault" />
                    <span className="text-[13px] font-semibold text-fault">Import failed</span>
                  </div>
                  <div className="text-[11.5px] text-fault font-mono">{error}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-rule bg-ink/10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="h-9 px-4 rounded-[8px] text-[13px] text-text-dim hover:text-text hover:bg-surface-hover disabled:opacity-60 transition-colors"
              >
                {result ? "Close" : "Cancel"}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={fire}
                  disabled={pending}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/85 disabled:opacity-60 transition-colors"
                >
                  {pending
                    ? <><Loader2 size={13} className="animate-spin" /> Importing…</>
                    : <><BookOpen size={13} /> Import 687 rows</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultGrid({ r }: { r: ImportBaselineCatalogResult }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
      <Row k="Rows processed"    v={r.rowsProcessed} />
      <Row k="Brands created"    v={r.brandsCreated} />
      <Row k="Collections created" v={r.collectionsCreated} />
      <Row k="Designs created"   v={r.designsCreated} />
      <Row k="SKUs created"      v={r.colourwaysCreated} />
      <Row k="Prices created"    v={r.pricesCreated} />
    </dl>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <>
      <dt className="text-text-dim">{k}</dt>
      <dd className="text-text tabular text-right">{v}</dd>
    </>
  );
}
