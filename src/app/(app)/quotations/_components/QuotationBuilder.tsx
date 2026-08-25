"use client";

// Quotation builder — two modes:
//   1. project mode (projectId + preloadedItems): prefills one line per
//      APPROVED measurement item. Owner picks a product for each →
//      quote line rate + colourway populate. Manual lines can still be
//      added for services/accessories. Owner canonical flow 2026-08-25.
//   2. lead mode (leadId + leadName): preliminary estimate before site
//      visit/conversion. §0.10 gate is relaxed server-side.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, Ruler } from "lucide-react";
import { createQuotation } from "@/modules/quotations/actions";
import { pickProductForMeasurementItem } from "@/modules/measurement/actions-item";
import type { BranchOption } from "@/modules/branches/queries";
import type { SELL_UNITS } from "@/modules/quotations/schema";
import type { FirmQuoteItem } from "@/modules/measurement/queries-firm-quote";
import type { PickerRow } from "@/modules/quotations/picker-types";
import { Th, iso } from "./_builder-primitives";
import { LineRow } from "./LineRow";
import type { LineInput } from "./quotation-line-types";
import { ProductPickerDialog } from "./ProductPickerDialog";

interface Props {
  branches:        BranchOption[];
  projectId?:      string;
  leadId?:         string;
  leadName?:       string;
  preloadedItems?: FirmQuoteItem[];
}

const EMPTY_LINE: LineInput = {
  description: "", quantity: "1", unit: "PIECE",
  rate: "", gstRate: "18", discountPct: "0",
  roomLabel: "", measurementItemId: "",
};

/** Convert a measurement-item hydration row into an editable builder line. */
function lineFromMeasurement(m: FirmQuoteItem): LineInput {
  const rateRupees = Number(m.suggestedRatePaise) / 100;
  const roomLabel  = m.floorLabel ? `${m.floorLabel} · ${m.roomName}` : m.roomName;
  const productLabel = m.colourwayId
    ? `${m.designName} — ${m.colourName} (${m.colourwayCode})`
    : undefined;
  return {
    description:       `${m.label} — ${roomLabel}`,
    quantity:          m.materialQty,
    unit:              m.materialUnit,
    rate:              rateRupees > 0 ? rateRupees.toFixed(2) : "",
    gstRate:           String(m.gstRate),
    discountPct:       "0",
    roomLabel,
    measurementItemId: m.measurementItemId,
    ...(m.colourwayId ? { colourwayId: m.colourwayId } : {}),
    ...(productLabel  ? { productLabel } : {}),
    family:            m.family,
  };
}

export function QuotationBuilder({ projectId, leadId, leadName, branches, preloadedItems = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerPending, startPickerTx] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const today = new Date();
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 30);

  const [branchId] = useState(branches[0]?.id ?? "");
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState("33");
  const [date] = useState(iso(today));
  const [validUntil] = useState(iso(nextMonth));

  // Init from measurement items when in project mode. Empty preload →
  // start with one blank line (matches previous behaviour for lead mode
  // and project mode without measurements).
  const initialLines = useMemo<LineInput[]>(() => {
    if (preloadedItems.length > 0) return preloadedItems.map(lineFromMeasurement);
    return [{ ...EMPTY_LINE }];
  }, [preloadedItems]);
  const [lines, setLines] = useState<LineInput[]>(initialLines);

  const isLeadMode    = !!leadId && !projectId;
  const isProjectMode = !!projectId;
  const hasMeasurements = preloadedItems.length > 0;

  if (!isLeadMode && !isProjectMode) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[15px] font-display text-text mb-2">Start from a project or lead</div>
        <p className="text-[12.5px] text-text-muted max-w-[420px] mx-auto">
          Quotations in Mandovara are linked to a project. Open a project and use its{" "}
          <strong>Quotation</strong> tab, or navigate from a lead record to create a
          preliminary estimate.
        </p>
      </div>
    );
  }

  const set = (i: number, f: keyof LineInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [f]: e.target.value } : l));

  function addLine() { setLines((ls) => [...ls, { ...EMPTY_LINE }]); }
  function removeLine(i: number) {
    if (lines.length > 1) setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function openPicker(i: number) { setPickerFor(i); }
  function closePicker()          { setPickerFor(null); }

  function onProductPicked(row: PickerRow) {
    const idx = pickerFor;
    if (idx == null) return;
    const target = lines[idx];
    if (!target) { closePicker(); return; }

    // Persist to CalcResult.colourwayId when this is a measurement row —
    // makes the choice visible on the measurement round + make jobs +
    // downstream. Manual rows just update local state.
    startPickerTx(async () => {
      if (target.measurementItemId) {
        const r = await pickProductForMeasurementItem({
          measurementItemId: target.measurementItemId,
          colourwayId:       row.colourwayId,
        });
        if (!r.ok) {
          setServerError(r.error ?? "Could not attach product to measurement");
          return;
        }
      }
      const rateRupees = Number(row.ratePaise) / 100;
      setLines((ls) => ls.map((l, i) => i === idx ? {
        ...l,
        colourwayId:  row.colourwayId,
        productLabel: row.displayName + ` (${row.code})`,
        rate:         rateRupees > 0 ? rateRupees.toFixed(2) : l.rate,
        gstRate:      String(row.gstRate),
        unit:         row.sellUnit,
      } : l));
      closePicker();
    });
  }

  function onSave() {
    setServerError(null);
    // A measurement row is valid iff a product is picked; manual rows
    // need description + rate.
    const valid = lines.filter((l) => (
      l.measurementItemId
        ? l.colourwayId && l.rate.trim()
        : l.description.trim() && l.rate.trim()
    ));
    if (!valid.length) { setServerError("Add at least one line with a product picked and rate."); return; }
    if (!branchId) { setServerError("Select a branch."); return; }
    if (placeOfSupplyCode.length !== 2) { setServerError("State code must be 2 digits."); return; }

    startTransition(async () => {
      const party = isLeadMode ? { leadId } : { projectId };
      const res = await createQuotation({
        ...party,
        branchId, date, validUntil, placeOfSupplyCode,
        lines: valid.map((l) => ({
          description:  l.description.trim(),
          quantity:     Number(l.quantity) || 1,
          unit:         l.unit as typeof SELL_UNITS[number],
          rate:         l.rate.trim(),
          gstRate:      Number(l.gstRate) as 0 | 5 | 12 | 18 | 28,
          discountPct:  Number(l.discountPct) || 0,
          ...(l.roomLabel.trim()         && { roomLabel:         l.roomLabel.trim() }),
          ...(l.measurementItemId.trim() && { measurementItemId: l.measurementItemId.trim() }),
        })),
      });
      if (!res.ok) { setServerError(res.error ?? "Could not create quotation"); return; }
      router.push(`/quotations/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  const pickerLine = pickerFor != null ? lines[pickerFor] : null;

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <div className={lbl}>Place of supply (state code)</div>
          <input value={placeOfSupplyCode}
                 onChange={(e) => setPlaceOfSupplyCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
                 maxLength={2} className={fld} placeholder="33 = Tamil Nadu" />
        </label>
        <div>
          <div className={lbl}>{isLeadMode ? "Lead" : "Project"}</div>
          <div className="h-[34px] flex items-center text-[11.5px] text-text-muted font-data">
            {isLeadMode ? leadName : projectId}
          </div>
        </div>
      </div>

      {isLeadMode && (
        <div className="rounded-[8px] bg-info/8 border border-info/25 px-4 py-3 text-[12.5px] text-text-muted">
          This is a preliminary estimate for a lead. Measurements are not required yet —
          after the client accepts and converts, raise a proper project quotation with
          site measurements attached.
        </div>
      )}

      {isProjectMode && hasMeasurements && (
        <div className="rounded-[8px] bg-gold/8 border border-gold/25 px-4 py-3 text-[12.5px] text-text flex items-start gap-2.5">
          <Ruler size={14} className="text-gold mt-[2px] shrink-0" />
          <span>
            <strong className="font-medium">{preloadedItems.length}</strong> measurement
            {preloadedItems.length === 1 ? "" : "s"} pre-loaded. Pick a product for each
            row to complete the firm quote.
          </span>
        </div>
      )}

      {isProjectMode && !hasMeasurements && (
        <div className="rounded-[8px] bg-info/8 border border-info/25 px-4 py-3 text-[12.5px] text-text-muted">
          No approved measurements yet. Add manual lines below for services, or take
          measurements from the project page for a full firm quote.
        </div>
      )}

      {/* Lines */}
      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                <Th width={28}>#</Th>
                <Th>Description & product</Th>
                <Th width={110}>Room</Th>
                <Th width={75}>Qty</Th>
                <Th width={90}>Unit</Th>
                <Th width={105}>Rate (₹)</Th>
                <Th width={68}>Disc %</Th>
                <Th width={65}>GST %</Th>
                <Th width={105} align="right">Amount</Th>
                <Th width={36}></Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <LineRow key={i} index={i} line={l} isOnly={lines.length === 1}
                         onChange={set} onRemove={removeLine} onPickProduct={openPicker} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-rule/60">
          <button type="button" onClick={addLine}
                  className="flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
            <Plus size={12} /> Add manual line (service, delivery, etc.)
          </button>
        </div>
      </div>

      {serverError && (
        <div className="rounded-[8px] bg-fault/10 border border-fault/30 px-4 py-3 text-[12.5px] text-fault">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="h-[38px] px-5 rounded-[8px] text-[13px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={pending || pickerPending}
                className="h-[38px] px-6 rounded-[8px] bg-gold text-ink text-[13px] font-medium hover:bg-gold-strong disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Save quotation"}
        </button>
      </div>

      <ProductPickerDialog
        open={pickerFor !== null}
        onClose={closePicker}
        onPick={onProductPicked}
        family={pickerLine?.family}
      />
    </div>
  );
}

const lbl = "mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-muted";
const fld = "w-full h-[34px] px-3 bg-surface-2 border border-border rounded-[6px] text-[12.5px] outline-none focus:border-gold transition-colors";
