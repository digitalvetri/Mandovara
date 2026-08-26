"use client";

// One-click importer that pushes the pre-extracted STOCK_IMPORT_ROWS
// (from the owner's WALLAPPER STOCK LIST xlsx) into Brand / Collection
// / Design / Colourway / StockBalance. Idempotent — the modal warns
// that re-runs replace on-hand quantities to match the sheet.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  importBaselineStock,
  type ImportBaselineStockResult,
} from "@/modules/inventory/actions-import";

export function ImportBaselineStockButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportBaselineStockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fire() {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const r = await importBaselineStock();
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
        <Upload size={13} strokeWidth={1.75} />
        Import stock
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Import baseline stock"
        >
          <div className="w-full max-w-[520px] rounded-[14px] border border-rule bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  Baseline stock import
                </div>
                <div className="text-[14px] font-semibold text-text mt-0.5">
                  Load stock from your Excel sheets
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
                    This imports the rows extracted from the four stock sheets in
                    <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
                      WALLAPPER STOCK LIST.xlsx
                    </code>
                    (MANDOVARA STOCK · BRAHMOS · FLOOR TILE · TRACK STOCK) into
                    the database. Creates any missing brand / collection /
                    design / SKU rows, then sets on-hand quantity to match the
                    sheet.
                  </p>
                  <p className="text-[12px] text-text-faint leading-relaxed">
                    Safe to re-run — if a SKU already exists with a different
                    quantity, an ADJUSTMENT stock move is recorded and the
                    balance is updated to the sheet value.
                  </p>
                  <p className="text-[11.5px] text-text-faint">
                    If your Excel changed, re-run
                    <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-text">
                      pnpm tsx scripts/extract-stock.ts
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
                    : <><Upload size={13} /> Import 140 rows</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultGrid({ r }: { r: ImportBaselineStockResult }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
      <Row k="Rows processed"    v={r.rowsProcessed} />
      <Row k="Stock balances set" v={r.stockBalancesSet} />
      <Row k="Brands created"    v={r.brandsCreated} />
      <Row k="Collections created" v={r.collectionsCreated} />
      <Row k="Designs created"   v={r.designsCreated} />
      <Row k="SKUs created"      v={r.colourwaysCreated} />
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
