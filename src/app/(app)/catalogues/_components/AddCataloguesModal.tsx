"use client";

import { useState, useTransition } from "react";
import { Plus, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { bulkAddCatalogues } from "@/modules/catalog/catalogues-actions";
import { FAMILY_LABEL } from "@/modules/catalog/catalogues-queries";

// Ordered exactly like the sheets in CATALOGUE LIST.xlsx so the family
// dropdown reads left-to-right in the same order the owner types things.
const FAMILY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "WALLPAPER",         label: FAMILY_LABEL.WALLPAPER },
  { value: "MURAL",             label: FAMILY_LABEL.MURAL },
  { value: "CURTAIN_FABRIC",    label: FAMILY_LABEL.CURTAIN_FABRIC },
  { value: "SHEER",             label: FAMILY_LABEL.SHEER },
  { value: "UPHOLSTERY_FABRIC", label: FAMILY_LABEL.UPHOLSTERY_FABRIC },
  { value: "FLOORING",          label: FAMILY_LABEL.FLOORING },
  { value: "CARPET_ROLL",       label: FAMILY_LABEL.CARPET_ROLL },
  { value: "RUG",               label: FAMILY_LABEL.RUG },
  { value: "BLIND",             label: FAMILY_LABEL.BLIND },
  { value: "LINING",            label: FAMILY_LABEL.LINING },
  { value: "HARDWARE_TRACK",    label: FAMILY_LABEL.HARDWARE_TRACK },
  { value: "HARDWARE_ROD",      label: FAMILY_LABEL.HARDWARE_ROD },
  { value: "MOTOR",             label: FAMILY_LABEL.MOTOR },
  { value: "ACCESSORY",         label: FAMILY_LABEL.ACCESSORY },
];

type Result = Awaited<ReturnType<typeof bulkAddCatalogues>>;

export function AddCataloguesModal() {
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<string>("WALLPAPER");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const previewCount = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .length;

  function submit() {
    setResult(null);
    start(async () => {
      const r = await bulkAddCatalogues(family, text);
      setResult(r);
      if (r.ok && r.created > 0) setText("");
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
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium text-white bg-accent hover:bg-accent/85 transition-colors"
      >
        <Plus size={13} strokeWidth={1.75} />
        Add catalogues
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          aria-label="Add catalogues"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <div className="relative w-full max-w-[560px] rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  New entries
                </div>
                <div className="text-[14px] font-semibold text-text mt-0.5">
                  Add catalogues
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
              <label className="block">
                <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  Category
                </div>
                <select
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  disabled={pending}
                  className="w-full h-[36px] px-3 rounded-[8px] border border-rule bg-surface text-[13px] outline-none focus:border-accent disabled:opacity-60"
                >
                  {FAMILY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    Catalogue names — one per line
                  </span>
                  {previewCount > 0 && (
                    <span className="text-[11px] text-text-dim tabular">
                      {previewCount} line{previewCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={pending}
                  placeholder={"HAPPY\nDUBAI\nLAVISH\nMACAU"}
                  rows={12}
                  className="w-full px-3 py-2.5 rounded-[8px] border border-rule bg-surface text-[13px] font-mono outline-none focus:border-accent resize-y disabled:opacity-60"
                />
              </label>

              {result && result.ok && (
                <div className="rounded-[10px] border border-solid/40 bg-solid/5 p-3 text-[12.5px] text-solid">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <div className="text-text">
                      <strong className="text-solid">{result.created} added</strong>
                      {result.skipped > 0 && <> · {result.skipped} already existed</>}
                      {result.invalid > 0 && <> · {result.invalid} invalid line{result.invalid === 1 ? "" : "s"}</>}
                    </div>
                  </div>
                </div>
              )}

              {result && !result.ok && (
                <div className="rounded-[10px] border border-fault/40 bg-fault/5 p-3 text-[12.5px] text-fault flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>{result.error ?? "Failed to add catalogues."}</div>
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
              <button
                type="button"
                onClick={submit}
                disabled={pending || previewCount === 0}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/85 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {pending
                  ? <><Loader2 size={13} className="animate-spin" /> Adding…</>
                  : <><Plus size={13} /> Add {previewCount > 0 ? `${previewCount} ` : ""}catalogue{previewCount === 1 ? "" : "s"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
