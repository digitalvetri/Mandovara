"use client";

// Right pane: for the selected order line, show existing allocations,
// available dye-lots, and the allocate form. Enforces §0.6 mixed-lot gate
// in the UI — the server enforces it authoritatively.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { allocateLots, releaseAllocation } from "@/modules/allocation/actions";
import type {
  OpenOrderLineRow,
  AvailableLotRow,
  AllocationRow,
} from "@/modules/allocation/queries";

interface Props {
  line: OpenOrderLineRow | null;
  lots: AvailableLotRow[];
  existing: AllocationRow[];
  canOverride: boolean;
}

export function AllocationPanel({ line, lots, existing, canOverride }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [qty, setQty] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activeLots = useMemo(
    () => existing.map((e) => e.dyeLot).filter((v, i, a) => a.indexOf(v) === i),
    [existing],
  );

  if (!line) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="font-display text-[18px] text-text mb-2">Select an order line</div>
        <div className="text-[12.5px] text-text-dim max-w-[40ch]">
          Pick a line from the left to see available dye-lots and allocate material. Mixed-lot allocation to a single line is blocked by default — §0.6.
        </div>
      </div>
    );
  }

  const selectedLot = lots.find((l) => l.batchId === selectedBatchId) ?? null;
  const wouldBeMixed = selectedLot != null
    && activeLots.length > 0
    && !activeLots.includes(selectedLot.dyeLot);

  function commit() {
    if (!line) return;
    if (!selectedBatchId) { setError("Pick a lot first."); return; }
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setError("Enter a positive quantity."); return;
    }
    setError(null); setFieldErrors({});
    const activeLineId = line.id;
    startTransition(async () => {
      const res = await allocateLots({
        orderLineId:      activeLineId,
        batchId:          selectedBatchId,
        quantity:         q,
        mixedLotOverride: wouldBeMixed,
        ...(wouldBeMixed && { overrideReason: overrideReason.trim() }),
      });
      if (!res.ok) {
        setError(res.error ?? "Could not allocate");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setQty(""); setOverrideReason(""); setSelectedBatchId(null);
      router.refresh();
    });
  }

  function release(id: string) {
    startTransition(async () => {
      const res = await releaseAllocation({ id });
      if (!res.ok) { setError(res.error ?? "Could not release"); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Header: which order line and how much still to reserve */}
      <div className="rounded-[14px] bg-surface border border-rule p-5">
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1">
          {line.salesOrderNumber} · {line.clientName}
        </div>
        <div className="font-display text-[20px] text-text mb-3">{line.productName}</div>
        <div className="grid grid-cols-3 gap-3 text-[12.5px]">
          <Stat label="Ordered"   value={`${line.orderedQty} ${line.uom}`} />
          <Stat label="Reserved"  value={`${line.reservedQty} ${line.uom}`} />
          <Stat label="To reserve" value={`${line.neededQty} ${line.uom}`} accent />
        </div>
      </div>

      {/* Existing allocations */}
      {existing.length > 0 && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 py-3 border-b border-rule text-[11px] uppercase tracking-[0.12em] text-text-dim">
            Existing allocations
          </div>
          <ul>
            {existing.map((a) => (
              <li key={a.id} className="px-4 py-3 border-b border-rule/60 last:border-0 flex items-center gap-3">
                <span className="tabular text-[11.5px] px-2 h-[22px] inline-flex items-center rounded bg-accent-tint text-accent">
                  {a.dyeLot}
                </span>
                <span className="tabular text-[13px] text-text">{a.quantity}</span>
                {a.mixedLotOverride && (
                  <span className="text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded bg-bad-tint text-bad">
                    mixed-lot override
                  </span>
                )}
                <div className="flex-1 min-w-0 text-[11.5px] text-text-dim truncate">
                  {a.overrideReason && <>Reason: {a.overrideReason}</>}
                </div>
                <button type="button" disabled={pending}
                        onClick={() => release(a.id)}
                        className="h-[26px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-bad hover:bg-bad-tint transition-colors">
                  Release
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Available lots + allocate form */}
      <div className="rounded-[14px] bg-surface border border-rule">
        <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim">
            Available dye-lots
          </div>
          <div className="text-[10.5px] text-text-faint">{lots.length} lot{lots.length === 1 ? "" : "s"}</div>
        </div>
        {lots.length === 0 ? (
          <div className="p-6 text-center text-[12.5px] text-text-dim">
            No lots in stock for {line.productName}. Post a GRN first.
          </div>
        ) : (
          <ul>
            {lots.map((lot) => {
              const isSelected = lot.batchId === selectedBatchId;
              const isForeign = activeLots.length > 0 && !activeLots.includes(lot.dyeLot);
              return (
                <li key={lot.batchId}
                    className={`px-4 py-3 border-b border-rule/60 last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-accent-tint" : "hover:bg-surface-hover"}`}
                    onClick={() => setSelectedBatchId(lot.batchId)}>
                  <div className="flex items-center gap-3">
                    <input type="radio" checked={isSelected} readOnly
                           className="accent-accent" />
                    <span className="tabular text-[12px] px-2 h-[22px] inline-flex items-center rounded bg-surface-hover border border-rule text-text">
                      {lot.dyeLot}
                    </span>
                    <span className="text-[11.5px] text-text-dim">{lot.warehouseName}</span>
                    {lot.binLocation && (
                      <span className="text-[11px] text-text-faint tabular">bin {lot.binLocation}</span>
                    )}
                    {isForeign && (
                      <span className="text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded bg-bad-tint text-bad">
                        different lot — would mix
                      </span>
                    )}
                    <div className="flex-1" />
                    <span className="tabular text-[13px] text-text">{lot.available}</span>
                    <span className="text-[10.5px] text-text-faint">avail / {lot.onHand} on-hand</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Allocate form */}
        <div className="p-4 border-t border-rule bg-surface-2/40">
          {wouldBeMixed && !canOverride && (
            <div className="mb-3 p-3 rounded-[8px] bg-bad-tint text-bad text-[12px] border border-bad/30">
              Mixed-lot allocation blocked. You do not hold <code>allocation.overrideMixedLot</code> — ask a supervisor to override.
            </div>
          )}
          {wouldBeMixed && canOverride && (
            <div className="mb-3 p-3 rounded-[8px] bg-bad-tint border border-bad/30">
              <div className="text-[12px] text-bad font-medium mb-2">
                This will introduce a second dye-lot to the same order line — §0.6 override required.
              </div>
              <textarea rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Reason for the mixed-lot override (audited)…"
                        className="w-full text-[12.5px] px-2 py-1.5 bg-white/70 border border-bad/40 rounded-[6px] text-text outline-none focus:border-bad" />
              {fieldErrors["overrideReason"] && (
                <div className="mt-1 text-[11.5px] text-bad">{fieldErrors["overrideReason"]}</div>
              )}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
                Quantity to allocate <span className="text-accent">*</span>
              </div>
              <input inputMode="decimal" value={qty}
                     onChange={(e) => setQty(e.target.value)}
                     placeholder="0"
                     disabled={!selectedBatchId || pending}
                     className="w-full h-[36px] px-3 tabular bg-white/70 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent disabled:opacity-50" />
              {fieldErrors["quantity"] && (
                <div className="mt-1 text-[11.5px] text-bad">{fieldErrors["quantity"]}</div>
              )}
            </div>
            <button type="button" onClick={commit}
                    disabled={
                      !selectedBatchId || pending
                      || (wouldBeMixed && !canOverride)
                    }
                    className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors">
              {pending ? "Allocating…" : wouldBeMixed ? "Allocate with override" : "Allocate"}
            </button>
          </div>
          {error && !fieldErrors["quantity"] && !fieldErrors["overrideReason"] && (
            <div className="mt-3 text-[12px] text-bad">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-faint">{label}</div>
      <div className={`tabular text-[15px] mt-0.5 ${accent ? "text-accent" : "text-text"}`}>{value}</div>
    </div>
  );
}
