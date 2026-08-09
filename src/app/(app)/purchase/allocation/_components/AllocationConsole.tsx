"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { allocateStock } from "@/modules/stock/actions";
import type { AllocationCandidateRow, StockBalanceRow } from "@/modules/stock/queries";

interface Props {
  candidates: AllocationCandidateRow[];
  stockByColourway: Record<string, StockBalanceRow[]>;
}

export function AllocationConsole({ candidates, stockByColourway }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">All order lines are allocated.</div>
        <p className="text-[12px] text-text-muted">Stock allocation is complete for all active orders.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            <Th>Order · Client</Th>
            <Th>Description</Th>
            <Th>Colourway</Th>
            <Th>Existing lot</Th>
            <Th align="right">Needed</Th>
            <Th align="right">Allocated</Th>
            <Th align="right">Remaining</Th>
            <Th width={110}></Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <CandidateRows
              key={c.orderLineId}
              candidate={c}
              lots={stockByColourway[c.colourwayId] ?? []}
              isActive={activeId === c.orderLineId}
              onToggle={() => setActiveId(activeId === c.orderLineId ? null : c.orderLineId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateRows({
  candidate: c,
  lots,
  isActive,
  onToggle,
}: {
  candidate: AllocationCandidateRow;
  lots: StockBalanceRow[];
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={`border-b border-rule/70 ${isActive ? "bg-surface-hover" : "hover:bg-surface-hover/50"} transition-colors`}>
        <Td>
          <div className="tabular text-text font-medium">{c.orderNumber}</div>
          <div className="text-[11.5px] text-text-muted">{c.clientName}</div>
        </Td>
        <Td>
          <div className="text-text">{c.description}</div>
          <div className="text-[11.5px] text-text-muted">{FAMILY_LABEL[c.family] ?? c.family}</div>
        </Td>
        <Td>
          <div className="tabular text-[11.5px] text-text-muted">{c.colourwayCode}</div>
          <div className="text-text-muted">{c.colourName}</div>
        </Td>
        <Td>
          {c.existingLot ? (
            <span className="inline-block px-2 py-0.5 rounded-[4px] bg-gold-tint text-gold font-data text-[11px] uppercase">
              {c.existingLot}
            </span>
          ) : (
            <span className="text-text-subtle text-[11.5px]">—</span>
          )}
        </Td>
        <Td align="right"><span className="tabular text-text">{trim(c.neededQty)} <span className="text-text-subtle">{c.unit}</span></span></Td>
        <Td align="right"><span className="tabular text-solid">{trim(c.allocatedQty)}</span></Td>
        <Td align="right">
          <span className={`tabular font-medium ${parseFloat(c.remainingQty) > 0 ? "text-heat" : "text-text-subtle"}`}>
            {trim(c.remainingQty)}
          </span>
        </Td>
        <Td>
          <button
            type="button"
            onClick={onToggle}
            className="h-[28px] px-3 rounded-[6px] text-[11.5px] border border-rule text-text-muted hover:text-gold hover:border-gold transition-colors"
          >
            {isActive ? "Close" : "Allocate"}
          </button>
        </Td>
      </tr>
      {isActive && (
        <tr className="border-b border-rule">
          <td colSpan={8} className="px-4 py-4 bg-surface-2">
            <AllocateForm candidate={c} lots={lots} onDone={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}

function AllocateForm({
  candidate: c,
  lots,
  onDone,
}: {
  candidate: AllocationCandidateRow;
  lots: StockBalanceRow[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dyeLot, setDyeLot] = useState(c.existingLot ?? "");
  const [quantity, setQuantity] = useState(trim(c.remainingQty));
  const [mixedLotOverride, setMixedLotOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isMixed = c.existingLot && dyeLot && c.existingLot !== dyeLot;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await allocateStock({
        orderLineId:      c.orderLineId,
        colourwayId:      c.colourwayId,
        dyeLot:           dyeLot.trim() || null,
        quantity:         Number(quantity),
        rate:             BigInt(c.rateStr),
        mixedLotOverride: mixedLotOverride || undefined,
        overrideReason:   overrideReason.trim() || undefined,
      });
      if (!res.ok) {
        if (res.errorCode === "MIXED_LOT") {
          setError("Mixed-lot allocation blocked. Check the override box and provide a reason.");
          setMixedLotOverride(true);
          return;
        }
        setError(res.error ?? "Allocation failed");
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[600px] space-y-4">
      {/* Available lots */}
      {lots.length > 0 ? (
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-text-muted mb-2">Available lots</div>
          <div className="flex flex-wrap gap-2">
            {lots.map((lot) => (
              <button
                key={lot.dyeLot ?? "__null__"}
                type="button"
                onClick={() => setDyeLot(lot.dyeLot ?? "")}
                className={[
                  "h-[30px] px-3 rounded-[6px] text-[11.5px] border transition-colors",
                  dyeLot === (lot.dyeLot ?? "")
                    ? "bg-gold text-ink border-gold font-medium"
                    : "bg-surface border-rule text-text-muted hover:text-text hover:border-gold",
                ].join(" ")}
              >
                {lot.dyeLot ?? "No lot"}
                <span className="ml-1.5 text-[10.5px] opacity-70">{trim(lot.available)} avail</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12.5px] text-fault">
          <AlertTriangle size={14} />
          <span>No stock available for this colourway. Receive a GRN first.</span>
        </div>
      )}

      {/* Manual dye lot + qty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="alloc-dye-lot" className="block mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-muted">Dye lot</label>
          <input
            id="alloc-dye-lot"
            value={dyeLot}
            onChange={(e) => setDyeLot(e.target.value)}
            placeholder="LOT-2608A (or blank for no lot)"
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="alloc-qty" className="block mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-muted">
            Quantity ({c.unit})
          </label>
          <input
            id="alloc-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${fieldCls} tabular`}
          />
        </div>
      </div>

      {/* Mixed-lot gate */}
      {isMixed && (
        <div className="rounded-[8px] bg-fault/10 border border-fault/30 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-fault mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-fault">
              <strong>Mixed-lot allocation</strong> — this line already has lot{" "}
              <span className="font-data">{c.existingLot}</span>. You are allocating from a different lot.
              This may cause a visible colour difference. Provide a reason to override.
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mixedLotOverride}
              onChange={(e) => setMixedLotOverride(e.target.checked)}
              className="accent-fault"
            />
            <span className="text-[12.5px] text-fault">I accept the mixed-lot risk and override the block</span>
          </label>
          {mixedLotOverride && (
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason: client approved shade variation; second delivery was from same production run…"
              className={`${fieldCls} border-fault/50`}
            />
          )}
        </div>
      )}

      {error && (
        <div className="rounded-[8px] bg-fault/10 border border-fault/30 px-3 py-2 text-[12px] text-fault">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || lots.length === 0}
                className="h-[34px] px-5 rounded-[8px] bg-gold text-ink text-[12.5px] font-medium hover:bg-gold-strong disabled:opacity-50 transition-colors">
          {pending ? "Allocating…" : "Confirm allocation"}
        </button>
        <button type="button" onClick={onDone}
                className="h-[34px] px-4 rounded-[8px] text-[12.5px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC: "Curtain", SHEER: "Sheer", LINING: "Lining", BLIND: "Blind",
  WALLPAPER: "Wallpaper", FLOORING: "Flooring", CARPET_ROLL: "Carpet roll",
  CARPET_TILE: "Carpet tile", UPHOLSTERY_FABRIC: "Upholstery",
  VERTICAL_GARDEN: "V. Garden", INTERIOR_FILM: "Film",
};

const fieldCls = "w-full h-[34px] px-3 bg-surface border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-gold transition-colors";

function trim(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
function Th({ children, align = "left", width }: { children?: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} align-top`}>
      {children}
    </td>
  );
}
