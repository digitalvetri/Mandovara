"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { createVendorBill } from "@/modules/purchase/vendor-bill-actions";
import { calcBillLine, calcBillTotals } from "@/lib/calc/vendor-bill";
import { GST_RATES } from "@/modules/purchase/schema";
import type { GRNForBilling } from "@/modules/purchase/vendor-bill-queries";

interface Props {
  poId: string;
  grns: GRNForBilling[];
}

export function VendorBillForm({ poId, grns }: Props) {
  const router                    = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setError]   = useState<string | null>(null);

  const [selectedGrnId, setSelectedGrnId] = useState<string>(grns[0]?.id ?? "");
  const [vendorInvoiceNo, setInvoiceNo]   = useState("");
  const [vendorInvoiceDate, setInvDate]   = useState("");
  const [billDate, setBillDate]           = useState(iso(new Date()));
  const [gstRates, setGstRates]           = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    grns[0]?.lines.forEach((l) => { init[l.colourwayId] = String(l.gstRate); });
    return init;
  });

  const selectedGrn = grns.find((g) => g.id === selectedGrnId);

  function onGrnChange(grnId: string) {
    setSelectedGrnId(grnId);
    const grn = grns.find((g) => g.id === grnId);
    const init: Record<string, string> = {};
    grn?.lines.forEach((l) => { init[l.colourwayId] = String(l.gstRate); });
    setGstRates(init);
  }

  const { lineCalcs, totals } = useMemo(() => {
    if (!selectedGrn) return { lineCalcs: [], totals: null };
    const lc = selectedGrn.lines.map((l) => {
      const rate = BigInt(l.ratePaise);
      const qty  = BigInt(Math.round(Number(l.quantity) * 10_000));
      const gst  = Number(gstRates[l.colourwayId] ?? l.gstRate);
      return calcBillLine(rate, qty, gst);
    });
    return { lineCalcs: lc, totals: calcBillTotals(lc) };
  }, [selectedGrn, gstRates]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGrn) return;
    setError(null);
    startTransition(async () => {
      const res = await createVendorBill({
        purchaseOrderId:   poId,
        grnId:             selectedGrn.id,
        vendorInvoiceNo:   vendorInvoiceNo || undefined,
        vendorInvoiceDate: vendorInvoiceDate || undefined,
        billDate,
        lines: selectedGrn.lines.map((l, i) => ({
          colourwayId: l.colourwayId,
          description: `${l.colourName} (${l.colourwayCode})`,
          quantity:    l.quantity,
          unit:        l.unit,
          ratePaise:   l.ratePaise,
          gstRate:     Number(gstRates[l.colourwayId] ?? l.gstRate),
          lineNo:      i + 1,
        })),
      });
      if (!res.ok) { setError(res.error ?? "Could not create vendor bill"); return; }
      router.push(`/purchase/${poId}` as Route);
      router.refresh();
    });
  }

  if (grns.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-10 text-center">
        <div className="text-[13.5px] text-text-dim">All goods receipts for this PO are already billed.</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-10">

      {/* ── Header fields ──────────────────────────────────────────────── */}
      <div className="rounded-[14px] bg-surface border border-rule p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {grns.length > 1 && (
          <Field label="Goods receipt" required>
            <select value={selectedGrnId} onChange={(e) => onGrnChange(e.target.value)} className={fieldCls}>
              {grns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.number} · {formatDate(g.receivedAt)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {grns.length === 1 && (
          <Field label="Goods receipt">
            <div className={`${fieldCls} flex items-center text-text-dim`}>
              {selectedGrn?.number} · {selectedGrn && formatDate(selectedGrn.receivedAt)}
            </div>
          </Field>
        )}
        <Field label="Vendor invoice no">
          <input value={vendorInvoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                 placeholder="e.g. INV-2024-882" className={fieldCls} />
        </Field>
        <Field label="Invoice date">
          <input type="date" value={vendorInvoiceDate} onChange={(e) => setInvDate(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Bill date" required>
          <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
      </div>

      {/* ── Lines ──────────────────────────────────────────────────────── */}
      {selectedGrn && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
          <table className="min-w-[480px] w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Colourway</Th>
                <Th align="right" width={90}>Qty</Th>
                <Th align="right" width={130}>Rate</Th>
                <Th align="right" width={80}>GST %</Th>
                <Th align="right" width={130}>Taxable</Th>
                <Th align="right" width={130}>Total</Th>
              </tr>
            </thead>
            <tbody>
              {selectedGrn.lines.map((l, i) => {
                const lc = lineCalcs[i];
                return (
                  <tr key={l.colourwayId} className="border-b border-rule/70 last:border-0">
                    <Td>
                      <div className="font-medium text-text">{l.colourwayCode}</div>
                      <div className="text-[11.5px] text-text-dim">{l.colourName}</div>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text">{Number(l.quantity).toFixed(2)}</span>{" "}
                      <span className="text-[10.5px] text-text-dim">{l.unit.toLowerCase()}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text-dim">{formatINR(BigInt(l.ratePaise))}</span>
                    </Td>
                    <Td align="right">
                      <select
                        value={gstRates[l.colourwayId] ?? String(l.gstRate)}
                        onChange={(e) => setGstRates((r) => ({ ...r, [l.colourwayId]: e.target.value }))}
                        className={`${cellCls} text-right w-[60px]`}
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={String(r)}>{r}%</option>
                        ))}
                      </select>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text">{lc ? formatINR(lc.taxable) : "—"}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text font-medium">{lc ? formatINR(lc.lineTotal) : "—"}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GST summary ────────────────────────────────────────────────── */}
      {totals && (
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-[12.5px]">
            <SummaryRow label="Taxable"  value={formatINR(totals.taxableAmount)} />
            <SummaryRow label="CGST"     value={formatINR(totals.cgst)} />
            <SummaryRow label="SGST"     value={formatINR(totals.sgst)} />
            {totals.roundOff !== 0n && (
              <SummaryRow label="Round-off" value={formatINR(totals.roundOff < 0n ? -totals.roundOff : totals.roundOff)
                .replace("₹", totals.roundOff < 0n ? "-₹" : "+₹")} />
            )}
            <div className="border-t border-rule pt-2 flex justify-between font-semibold text-[14px]">
              <span className="text-text-dim">Total</span>
              <span className="tabular text-text">{formatINR(totals.total)}</span>
            </div>
          </div>
        </div>
      )}

      {serverError && <div className="text-[12px] text-fault">{serverError}</div>}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending}
                className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Raise vendor bill"}
        </button>
      </div>
    </form>
  );
}

const fieldCls = "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent transition-colors";
const cellCls  = "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
    </div>
  );
}
function Th({ children, align = "left", width }: { children?: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-text-dim">
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
