"use client";

// The GST half of the new-expense form.
//
// Split out of NewExpenseForm.tsx to keep that file under the §10 300-line
// ceiling, and because these four fields are one idea: they appear together,
// behind one toggle, and only matter when the studio is claiming input
// credit. The common expense — a cab fare, a courier — never opens this.

import { GST_RATES } from "@/modules/expenses/schema";

export const expenseFieldCls =
  "w-full h-10 rounded-[8px] border border-rule bg-transparent px-2.5 text-[12.5px] " +
  "text-text outline-none focus:border-gold transition-colors";

export const expenseLabelCls = "mb-1 block text-[11px] text-text-dim";

/** Live split of a GST-inclusive total, shown under the amount field. */
export function GstPreview({
  totalPaise, gstRate, isInterState,
}: { totalPaise: bigint; gstRate: number; isInterState: boolean }) {
  if (gstRate <= 0 || totalPaise <= 0n) return null;
  const taxable = (totalPaise * 100n) / BigInt(100 + gstRate);
  const gst     = totalPaise - taxable;
  const rupees  = (p: bigint) => (Number(p) / 100).toFixed(2);
  return (
    <div className="mt-1.5 space-y-0.5 text-[10.5px] text-text-dim">
      <div>Taxable: ₹{rupees(taxable)}</div>
      <div>
        {isInterState
          ? `IGST (${gstRate}%)`
          : `CGST ${gstRate / 2}% + SGST ${gstRate / 2}%`}
        : ₹{rupees(gst)}
      </div>
    </div>
  );
}

export interface GstFieldsProps {
  gstRate:         number;
  setGstRate:      (v: number) => void;
  isInterState:    boolean;
  setIsInterState: (v: boolean) => void;
  vendorGstin:     string;
  setVendorGstin:  (v: string) => void;
  billRef:         string;
  setBillRef:      (v: string) => void;
}

export function GstFields({
  gstRate, setGstRate,
  isInterState, setIsInterState,
  vendorGstin, setVendorGstin,
  billRef, setBillRef,
}: GstFieldsProps) {
  return (
    <>
      <div className="sm:col-span-4">
        <label className={expenseLabelCls} htmlFor="exp-gst-rate">GST rate</label>
        <select
          id="exp-gst-rate"
          value={gstRate}
          onChange={(e) => setGstRate(Number(e.target.value))}
          className={expenseFieldCls}
        >
          {GST_RATES.map((r) => (
            <option key={r} value={r}>{r === 0 ? "Exempt / nil" : `${r}%`}</option>
          ))}
        </select>
      </div>

      {/* Only asked once a rate is set — an exempt expense has no state split. */}
      {gstRate > 0 && (
        <div className="flex items-end sm:col-span-8">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isInterState}
              onChange={(e) => setIsInterState(e.target.checked)}
              className="h-4 w-4 rounded border-rule accent-gold"
            />
            <span className="text-[12px] text-text-dim">Out-of-state purchase (IGST)</span>
          </label>
        </div>
      )}

      <div className="sm:col-span-6">
        <label className={expenseLabelCls} htmlFor="exp-gstin">Vendor GSTIN (optional)</label>
        <input
          id="exp-gstin"
          value={vendorGstin}
          onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
          placeholder="33AABCM1234Q1Z5"
          maxLength={15}
          className={`${expenseFieldCls} tabular-nums`}
        />
      </div>

      <div className="sm:col-span-6">
        <label className={expenseLabelCls} htmlFor="exp-billref">Vendor invoice no. (optional)</label>
        <input
          id="exp-billref"
          value={billRef}
          onChange={(e) => setBillRef(e.target.value)}
          placeholder="e.g. INV/2026-27/0048"
          maxLength={50}
          className={expenseFieldCls}
        />
      </div>
    </>
  );
}
