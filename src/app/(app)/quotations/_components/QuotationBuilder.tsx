"use client";

// Quotation builder — project-centric, matching the Mandovara measure-to-install flow.
// Start from a project (pass ?project=<id> in the URL). Lines are added manually.
// The §0.10 measurement gate is enforced server-side; measurementItemId is optional
// only for non-made-to-measure lines (accessories, services, etc.).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Plus, X } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { createQuotation } from "@/modules/quotations/actions";
import type { BranchOption } from "@/modules/branches/queries";
import { SELL_UNITS } from "@/modules/quotations/schema";
import { Th, Td, iso } from "./_builder-primitives";

interface LineInput {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  gstRate: string;
  discountPct: string;
  roomLabel: string;
  measurementItemId: string;
}

interface Props {
  projectId: string;
  branches: BranchOption[];
}

const EMPTY_LINE: LineInput = {
  description: "", quantity: "1", unit: "PIECE",
  rate: "", gstRate: "18", discountPct: "0",
  roomLabel: "", measurementItemId: "",
};

export function QuotationBuilder({ projectId, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const today = new Date();
  const nextMonth = new Date(); nextMonth.setDate(today.getDate() + 30);

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState("33");
  const [date] = useState(iso(today));
  const [validUntil] = useState(iso(nextMonth));
  const [lines, setLines] = useState<LineInput[]>([{ ...EMPTY_LINE }]);

  if (!projectId) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-14 text-center">
        <div className="text-[15px] font-display text-text mb-2">Start from a project</div>
        <p className="text-[12.5px] text-text-muted max-w-[420px] mx-auto">
          Quotations in Mandovara are always linked to a project. Open a project and use its{" "}
          <strong>Quotation</strong> tab — or navigate here with{" "}
          <code className="font-data text-[11px]">?project=&lt;id&gt;</code>.
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

  function lineAmount(l: LineInput): string {
    const r = Number(l.rate.replace(/,/g, "")) || 0;
    const q = Number(l.quantity) || 0;
    const d = Number(l.discountPct) || 0;
    const taxable = r * q * (1 - d / 100);
    return formatINR(BigInt(Math.round((taxable + taxable * (Number(l.gstRate) / 100)) * 100)));
  }

  function onSave() {
    setServerError(null); setFieldErrors({});
    const valid = lines.filter((l) => l.description.trim() && l.rate.trim());
    if (!valid.length) { setServerError("Add at least one line with description and rate."); return; }
    if (!branchId) { setServerError("Select a branch."); return; }
    if (placeOfSupplyCode.length !== 2) { setServerError("State code must be 2 digits."); return; }

    startTransition(async () => {
      const res = await createQuotation({
        projectId, branchId, date, validUntil, placeOfSupplyCode,
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
      if (!res.ok) {
        setServerError(res.error ?? "Could not create quotation");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      router.push(`/quotations/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <div className={lbl}>Branch</div>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fld}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className={lbl}>Place of supply (state code)</div>
          <input value={placeOfSupplyCode}
                 onChange={(e) => setPlaceOfSupplyCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
                 maxLength={2} className={fld} placeholder="33 = Tamil Nadu" />
        </label>
        <div>
          <div className={lbl}>Project</div>
          <div className="h-[34px] flex items-center text-[11.5px] text-text-muted font-data">{projectId}</div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                <Th width={28}>#</Th>
                <Th>Description</Th>
                <Th width={85}>Room</Th>
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
                <tr key={i} className="border-b border-rule/60 last:border-0 align-middle">
                  <Td><span className="tabular text-text-muted text-[11px]">{i + 1}</span></Td>
                  <Td>
                    <input value={l.description} onChange={set(i, "description")}
                           placeholder="e.g. Main curtain — Master bedroom" className={cel} />
                  </Td>
                  <Td>
                    <input value={l.roomLabel} onChange={set(i, "roomLabel")}
                           placeholder="Room" className={cel} />
                  </Td>
                  <Td>
                    <input value={l.quantity} onChange={set(i, "quantity")}
                           inputMode="decimal" className={`${cel} tabular text-right`} />
                  </Td>
                  <Td>
                    <select value={l.unit} onChange={set(i, "unit")} className={cel}>
                      {SELL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Td>
                  <Td>
                    <input value={l.rate} onChange={set(i, "rate")}
                           inputMode="decimal" placeholder="0.00" className={`${cel} tabular text-right`} />
                  </Td>
                  <Td>
                    <input value={l.discountPct} onChange={set(i, "discountPct")}
                           inputMode="decimal" className={`${cel} tabular text-right`} />
                  </Td>
                  <Td>
                    <select value={l.gstRate} onChange={set(i, "gstRate")} className={cel}>
                      {["0","5","12","18","28"].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </Td>
                  <Td align="right">
                    <span className="tabular text-text font-medium">{lineAmount(l)}</span>
                  </Td>
                  <Td>
                    <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                            aria-label="Remove" className="h-[28px] w-[28px] grid place-items-center rounded-[4px] text-text-subtle hover:text-fault hover:bg-fault/10 disabled:opacity-30 transition-colors">
                      <X size={12} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-rule/60">
          <button type="button" onClick={addLine}
                  className="flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] text-[12px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
            <Plus size={12} /> Add line
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
        <button type="button" onClick={onSave} disabled={pending}
                className="h-[38px] px-6 rounded-[8px] bg-gold text-ink text-[13px] font-medium hover:bg-gold-strong disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Save quotation"}
        </button>
      </div>
    </div>
  );
}

const lbl = "mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-muted";
const fld = "w-full h-[34px] px-3 bg-surface-2 border border-border rounded-[6px] text-[12.5px] outline-none focus:border-gold transition-colors";
const cel = "w-full h-[28px] px-2 bg-surface-2 border border-border rounded-[4px] text-[12.5px] outline-none focus:border-gold transition-colors";
