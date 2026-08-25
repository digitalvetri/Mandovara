"use client";

// "Delete every collection under this brand" — keeps the brand shell so
// PDFs can be re-uploaded fresh. Refuses if any transactional record
// still references the SKUs (message names what's blocking).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { wipeBrandCollections } from "@/modules/catalog/brand-actions";

interface Props {
  brandId:         string;
  brandName:       string;
  collectionCount: number;
  designCount:     number;
}

export function WipeCollectionsButton({ brandId, brandName, collectionCount, designCount }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [pending, start]      = useTransition();

  function handleWipe() {
    setError(null);
    start(async () => {
      const res = await wipeBrandCollections(brandId);
      if (!res.ok) { setError(res.error ?? "Wipe failed"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (collectionCount === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium text-fault border border-fault/40 hover:bg-fault/8 transition-colors"
        aria-label={`Delete all collections in ${brandName}`}
        title="Delete every collection under this brand"
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Wipe collections
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={`Wipe collections in ${brandName}`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !pending && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-[14px] bg-surface border border-rule shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
              <h3 className="text-[14px] font-semibold text-text">Wipe all collections?</h3>
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
                Delete every collection under <span className="font-semibold">{brandName}</span>?
                The brand itself will stay so you can re-upload PDFs.
              </p>
              <div className="rounded-[8px] border border-fault/25 bg-fault/8 p-3 flex gap-2.5">
                <AlertTriangle size={15} strokeWidth={1.75} className="text-fault mt-0.5 shrink-0" />
                <div className="text-[12px] text-text space-y-1">
                  <div className="font-medium">This will delete:</div>
                  <ul className="text-text-dim list-disc pl-4">
                    <li>{collectionCount} collection{collectionCount === 1 ? "" : "s"} + attached PDFs</li>
                    {designCount > 0 && (
                      <li>{designCount} design{designCount === 1 ? "" : "s"} + all their colourways, prices and stock balances</li>
                    )}
                  </ul>
                  <div className="text-text-dim pt-1">
                    Refused if any quotation, order, PO, GRN, stock move, allocation or sample book references these designs.
                  </div>
                </div>
              </div>
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
                  onClick={handleWipe}
                  disabled={pending}
                  className="h-8 px-4 rounded-[7px] text-[12px] font-semibold bg-fault text-white hover:bg-fault/85 disabled:opacity-60 transition-colors"
                >
                  {pending ? "Wiping…" : "Delete all"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
