"use client";

import { useState } from "react";
import type { AllocationCandidateRow, StockBalanceRow } from "@/modules/stock/queries";
import { AllocateForm, trim } from "./AllocateForm";

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

const FAMILY_LABEL: Record<string, string> = {
  CURTAIN_FABRIC: "Curtain", SHEER: "Sheer", LINING: "Lining", BLIND: "Blind",
  WALLPAPER: "Wallpaper", FLOORING: "Flooring", CARPET_ROLL: "Carpet roll",
  CARPET_TILE: "Carpet tile", UPHOLSTERY_FABRIC: "Upholstery",
  VERTICAL_GARDEN: "V. Garden", INTERIOR_FILM: "Film",
};

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
