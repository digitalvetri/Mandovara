// Pending Stock Verification page — /inventory/pending
//
// Shows all stock items that are physically in the showroom but cannot yet be
// imported into the system because their brand, collection, or family is unconfirmed.
//
// IMPORTANT: None of these items appear in StockBalance or contribute to any
// stock KPI (Items, Low Stock, Stock Value). They are a review-only list.
// Import only happens after physical label verification and catalogue matching.

import { Topbar } from "@/components/layout/Topbar";
import { InventoryTabs } from "../_components/InventoryTabs";
import { AlertTriangle, Info } from "lucide-react";
import pendingData from "@/data/pending-stock.json";

export const dynamic = "force-dynamic";

// ── Types inferred from the JSON shape ──────────────────────────────────────

interface PendingItem {
  id: string;
  catalogueName: string | null;
  code: string;
  qty: number;
  unit: string;
  lengthInches?: number | null;
  lengthMm?: number | null;
  proposedMapping: string | null;
  pendingReason: string;
  confirmNeeded: string;
}

interface PendingSection {
  key: string;
  label: string;
  source: string;
  description: string;
  items: PendingItem[];
}

// ── Derived counts ───────────────────────────────────────────────────────────

function totalItems(sections: PendingSection[]): number {
  return sections.reduce((s, sec) => s + sec.items.length, 0);
}

function totalUnits(sections: PendingSection[]): { rolls: number; pieces: number } {
  let rolls = 0; let pieces = 0;
  for (const sec of sections) {
    for (const item of sec.items) {
      if (item.unit === "ROLL") rolls += item.qty;
      else pieces += item.qty;
    }
  }
  return { rolls, pieces };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PendingStockPage() {
  const sections = pendingData.sections as PendingSection[];
  const items    = totalItems(sections);
  const units    = totalUnits(sections);

  return (
    <>
      <Topbar title="" />

      <div className="mb-4">
        <h1 className="font-display text-[28px] font-semibold leading-none text-text">
          Pending Verification
        </h1>
        <div className="mt-1 text-[12px] text-text-dim">
          Stock items physically in the showroom — awaiting label inspection before import
        </div>
      </div>

      <InventoryTabs active="pending" />

      {/* Notice banner */}
      <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-fault/30 bg-fault/8 px-4 py-3">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-fault" />
        <div className="text-[12.5px] text-text">
          <span className="font-semibold text-fault">None of these items count toward stock totals or KPIs.</span>
          {" "}They are recorded here for tracking only. Each item must have its brand, collection, and
          family confirmed from the physical roll or hardware label before it can be imported.
          Do not create catalogue entries based on assumptions.
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-5 flex flex-wrap gap-3">
        <StatChip label="Pending entries" value={String(items)} />
        {units.rolls > 0 && <StatChip label="Rolls on hold" value={`${units.rolls} rolls`} />}
        {units.pieces > 0 && <StatChip label="Hardware pieces on hold" value={`${units.pieces} pcs`} />}
        <StatChip label="Last updated" value={pendingData.lastUpdated} muted />
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <Section key={sec.key} section={sec} />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 flex items-start gap-2 rounded-[10px] border border-rule bg-surface-2 px-4 py-3">
        <Info size={13} className="mt-0.5 shrink-0 text-text-dim" />
        <p className="text-[11.5px] leading-relaxed text-text-dim">
          To resolve an item: inspect the physical label → add the correct collection to the Product
          Catalogue → re-run the import script (idempotent, already-imported rows are skipped).
          For project/bespoke rolls, assign them to the relevant project rather than general stock.
          This list is maintained in{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-[10.5px] text-text">
            src/data/pending-stock.json
          </code>
          {" "}and{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-[10.5px] text-text">
            docs/PENDING-STOCK-VERIFICATION.md
          </code>.
        </p>
      </div>
    </>
  );
}

// ── Section component ────────────────────────────────────────────────────────

function Section({ section }: { section: PendingSection }) {
  const unitTotal = section.items.reduce((s, i) => s + i.qty, 0);
  const unitLabel = section.items[0]?.unit === "ROLL" ? "rolls" : "pcs";

  return (
    <div className="rounded-[14px] border border-rule bg-surface">
      {/* Section header */}
      <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">{section.label}</span>
            <span className="rounded-full bg-heat/12 px-2 py-0.5 text-[10.5px] font-medium text-heat">
              {section.items.length} items · {unitTotal} {unitLabel}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-text-dim">
            {section.description}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-rule px-2.5 py-1 text-[10.5px] text-text-dim">
          {section.source}
        </span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-rule bg-surface-2">
              <Th>Collection (Excel)</Th>
              <Th>Code</Th>
              <Th align="right">Qty</Th>
              {section.key === "track-hardware" && <Th>Length</Th>}
              <Th>Proposed mapping</Th>
              <Th>Pending reason</Th>
              <Th>What to confirm from label</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {section.items.map((item) => (
              <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                <Td>
                  {item.catalogueName ? (
                    <span className="font-medium text-text">{item.catalogueName}</span>
                  ) : (
                    <span className="text-text-dim italic">unknown</span>
                  )}
                </Td>
                <Td>
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
                    {item.code}
                  </code>
                </Td>
                <Td align="right">
                  <span className="tabular-nums font-medium text-text">
                    {item.qty} {item.unit.toLowerCase()}
                  </span>
                </Td>
                {section.key === "track-hardware" && (
                  <Td>
                    {item.lengthInches != null ? (
                      <span className="tabular-nums text-text-dim">
                        {item.lengthInches} in / {item.lengthMm?.toFixed(1)} mm
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </Td>
                )}
                <Td>
                  {item.proposedMapping ? (
                    <span className="text-text-dim">{item.proposedMapping}</span>
                  ) : (
                    <span className="text-text-dim italic">none</span>
                  )}
                </Td>
                <Td>
                  <span className="text-text-dim">{item.pendingReason}</span>
                </Td>
                <Td>
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0 text-heat" />
                    <span className="text-text">{item.confirmNeeded}</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-text-dim ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`px-4 py-3 align-top leading-relaxed ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function StatChip({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[10px] border border-rule bg-surface px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-0.5 tabular-nums text-[16px] font-semibold ${muted ? "text-text-dim" : "text-text"}`}>
        {value}
      </div>
    </div>
  );
}
