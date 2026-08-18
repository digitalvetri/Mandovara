"use client";

// The store keeper's surface for §0.6. One row per open order line; expanding a
// row shows the dye lots actually on the shelf for that colourway.
//
// The mixed-lot rule is enforced server-side in allocation/core.ts — this UI
// exists so the rule is visible BEFORE the mistake, not as a toast after it.
// §6.3.6: "A mixed-lot allocation is blocked with a red inline gate, not a toast."

import { useState, useTransition } from "react";
import { AlertTriangle, PackageCheck, ChevronDown, ChevronRight } from "lucide-react";
import type { AvailableLotRow, OpenOrderLineRow } from "@/modules/allocation/queries";
import { allocateLots } from "@/modules/allocation/actions";
import { lotsForColourway } from "../actions";

export function AllocationConsole({ lines }: { lines: OpenOrderLineRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 bg-surface-2 text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
        <div>Order line</div>
        <div className="text-right">Ordered</div>
        <div className="text-right">Allocated</div>
        <div className="text-right">Needed</div>
        <div>Lots</div>
      </div>

      {lines.map((line) => (
        <LineRow
          key={line.id}
          line={line}
          open={openId === line.id}
          onToggle={() => setOpenId(openId === line.id ? null : line.id)}
        />
      ))}
    </div>
  );
}

function LineRow({
  line, open, onToggle,
}: { line: OpenOrderLineRow; open: boolean; onToggle: () => void }) {
  const [lots, setLots]     = useState<AvailableLotRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const mixed = line.existingLotCount > 1;

  async function toggle() {
    onToggle();
    if (!open && lots === null) {
      setLoading(true);
      const res = await lotsForColourway(line.colourwayId);
      setLots(res.ok ? (res.data ?? []) : []);
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
      >
        <div className="min-w-0 flex items-start gap-2">
          {open ? <ChevronDown size={14} className="mt-0.5 shrink-0 text-text-muted" />
                : <ChevronRight size={14} className="mt-0.5 shrink-0 text-text-muted" />}
          <div className="min-w-0">
            <div className="text-[12.5px] text-text truncate">{line.productName}</div>
            <div className="text-[11px] text-text-muted truncate">
              {line.salesOrderNumber} · {line.clientName}
            </div>
          </div>
        </div>
        <div className="tabular text-[12px] text-text-dim text-right">{line.orderedQty}</div>
        <div className="tabular text-[12px] text-text-dim text-right">{line.allocatedQty}</div>
        <div className="tabular text-[12px] text-text text-right">{line.neededQty}</div>
        <div className="flex items-center gap-1.5">
          {line.existingLots.length === 0 && (
            <span className="text-[11px] text-text-faint">none</span>
          )}
          {line.existingLots.map((lot) => (
            <span key={lot} className="font-data text-[10.5px] px-1.5 py-0.5 rounded bg-surface-2 text-text-dim">
              {lot}
            </span>
          ))}
          {mixed && (
            <span
              className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-fault/15 text-fault"
              title="This line already draws on more than one dye lot"
            >
              <AlertTriangle size={11} strokeWidth={2} /> Mixed
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pl-10">
          {loading && <div className="text-[12px] text-text-muted py-2">Reading the shelf…</div>}
          {!loading && lots?.length === 0 && (
            <div className="text-[12px] text-fault py-2">
              No stock on hand for this design. Raise a purchase order before allocating.
            </div>
          )}
          {!loading && lots && lots.length > 0 && (
            <LotPicker line={line} lots={lots} />
          )}
        </div>
      )}
    </div>
  );
}

function LotPicker({ line, lots }: { line: OpenOrderLineRow; lots: AvailableLotRow[] }) {
  const [batchId, setBatchId]   = useState(lots[0]?.batchId ?? "");
  const [qty, setQty]           = useState(line.neededQty);
  const [reason, setReason]     = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState<string | null>(null);
  const [pending, start]        = useTransition();

  const chosen = lots.find((l) => l.batchId === batchId);
  // The inline gate: allocating this lot would put a second dye lot on the line.
  const wouldBeMixed =
    !!chosen && line.existingLots.length > 0 && !line.existingLots.includes(chosen.dyeLot);

  function submit() {
    setError(null); setDone(null);
    start(async () => {
      const res = await allocateLots({
        orderLineId: line.id,
        batchId,
        quantity: Number(qty),
        mixedLotOverride: wouldBeMixed,
        ...(wouldBeMixed ? { overrideReason: reason } : {}),
      });
      if (res.ok) setDone(`Reserved ${qty} from ${chosen?.dyeLot}.`);
      else setError(res.error ?? "Could not allocate.");
    });
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="grid gap-2">
        {lots.map((lot) => (
          <label
            key={lot.batchId}
            className={`flex items-center gap-3 px-3 py-2 rounded-[8px] border cursor-pointer transition-colors ${
              batchId === lot.batchId ? "border-gold/50 bg-gold/5" : "border-border hover:border-border"
            }`}
          >
            <input
              type="radio"
              name={`lot-${line.id}`}
              value={lot.batchId}
              checked={batchId === lot.batchId}
              onChange={() => setBatchId(lot.batchId)}
            />
            <span className="font-data text-[11.5px] text-text">{lot.dyeLot}</span>
            <span className="tabular text-[11.5px] text-text-muted">
              {lot.available} available of {lot.onHand}
            </span>
            {lot.binLocation && (
              <span className="text-[11px] text-text-faint ml-auto">bin {lot.binLocation}</span>
            )}
          </label>
        ))}
      </div>

      {wouldBeMixed && (
        // Red inline gate, per §6.3.6 — not a toast, and not dismissible.
        <div className="rounded-[8px] border border-fault/40 bg-fault/10 p-3">
          <div className="flex items-start gap-2 text-[12.5px] text-fault font-medium">
            <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>
              This line already uses {line.existingLots.join(", ")}. Adding{" "}
              {chosen?.dyeLot} puts two dye lots on one job — the shade will not
              match across the run.
            </span>
          </div>
          <label className="block mt-2 text-[11px] uppercase tracking-[0.12em] text-text-muted">
            Reason for override (recorded against your name)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Lot short by 2m; second lot goes on the opposite wall"
            className="mt-1 w-full h-9 px-3 rounded-[6px] bg-surface border border-fault/30 text-[12.5px] text-text"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Qty</label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          className="h-9 w-28 px-3 rounded-[6px] bg-surface border border-border text-[12.5px] text-text tabular"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !batchId || (wouldBeMixed && reason.trim().length < 4)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] bg-gold/15 text-gold border border-gold/30 text-[12.5px] font-medium hover:bg-gold/25 disabled:opacity-50"
        >
          <PackageCheck size={14} strokeWidth={1.75} />
          {pending ? "Reserving…" : wouldBeMixed ? "Override & reserve" : "Reserve"}
        </button>
      </div>

      {error && <p className="text-[12px] text-fault">{error}</p>}
      {done  && <p className="text-[12px] text-solid">{done}</p>}
    </div>
  );
}
