"use client";

// Inline "Post GRN" form under a Purchase Order detail. Enter received qty
// per pending line + warehouse. Server posts to the stock ledger, ratchets
// receivedQty, and updates PO status.

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postGRN } from "@/modules/purchase/actions";
import type { POLineRow } from "@/modules/purchase/queries";

interface Props {
  purchaseOrderId: string;
  warehouses: { id: string; name: string }[];
  lines: POLineRow[];
}

export function GRNForm({ purchaseOrderId, warehouses, lines }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? "");
  const [receivedAt, setReceivedAt] = useState<string>(iso(new Date()));
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [invoiceRef, setInvoiceRef] = useState<string>("");
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  // Per-line dye-lot capture. §0.6: batch-tracked products require a dye-lot.
  const [dyeLotByLine, setDyeLotByLine] = useState<Record<string, string>>({});
  const [rollCountByLine, setRollCountByLine] = useState<Record<string, string>>({});
  const [binByLine, setBinByLine] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const pendingLines = lines.filter((l) => parseFloat(l.pendingQty) > 0);
  if (pendingLines.length === 0) return null;

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    const linesPayload = pendingLines
      .map((l) => {
        const quantity = Number(qtyByLine[l.id] ?? 0);
        if (quantity <= 0) return null;
        const dyeLot = (dyeLotByLine[l.id] ?? "").trim();
        const rollCountRaw = (rollCountByLine[l.id] ?? "").trim();
        const rollCount = rollCountRaw !== "" ? Number(rollCountRaw) : undefined;
        const binLocation = (binByLine[l.id] ?? "").trim();
        return {
          poLineId: l.id, quantity,
          ...(dyeLot !== "" && { dyeLot }),
          ...(rollCount != null && Number.isFinite(rollCount) && { rollCount }),
          ...(binLocation !== "" && { binLocation }),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (linesPayload.length === 0) { setError("Enter a quantity on at least one line."); return; }
    startTransition(async () => {
      const res = await postGRN({
        purchaseOrderId, warehouseId, receivedAt,
        vehicleNumber, invoiceRef, lines: linesPayload,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not post GRN");
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      setQtyByLine({}); setDyeLotByLine({}); setRollCountByLine({}); setBinByLine({});
      setVehicleNumber(""); setInvoiceRef("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-4 flex items-center justify-between">
        <div className="text-[12.5px] text-text-dim">
          {pendingLines.length} line{pendingLines.length === 1 ? "" : "s"} pending receipt.
        </div>
        <button type="button" onClick={() => setOpen(true)}
                className="h-[32px] px-4 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover transition-colors">
          Post GRN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={commit} className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Field label="Received on" required>
          <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Into warehouse" required>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={fieldCls}>
            {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
          </select>
        </Field>
        <Field label="Vehicle number">
          <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
                 placeholder="e.g. TN 39 AB 1234"
                 className={`${fieldCls} tabular uppercase`} />
        </Field>
        <Field label="Vendor invoice ref">
          <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)}
                 placeholder="e.g. INV-2024-882"
                 className={`${fieldCls} tabular`} />
        </Field>
      </div>

      <div className="border border-rule rounded-[8px] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Product</Th>
              <Th align="right">Ordered</Th>
              <Th align="right">Already received</Th>
              <Th align="right">Pending</Th>
              <Th align="right" width={140}>Receive now</Th>
            </tr>
          </thead>
          <tbody>
            {pendingLines.map((l) => {
              const dyeLotErr = fieldErrors[`lines.${l.id}.dyeLot`];
              return (
                <Fragment key={l.id}>
                  <tr className={`border-b ${l.trackBatch ? "border-transparent" : "border-rule/60"} last:border-0`}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="tabular text-text-dim text-[11.5px]">{l.productCode}</div>
                          <div className="text-text">{l.description}</div>
                        </div>
                        {l.trackBatch && (
                          <span className="tabular text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded bg-accent-tint text-accent">
                            dye-lot
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{l.orderedQty} <span className="text-text-faint">{l.uom}</span></span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{l.receivedQty}</span></Td>
                    <Td align="right"><span className="tabular text-text">{l.pendingQty}</span></Td>
                    <Td align="right">
                      <input inputMode="decimal" value={qtyByLine[l.id] ?? ""}
                             onChange={(e) => setQtyByLine((q) => ({ ...q, [l.id]: e.target.value }))}
                             placeholder="0"
                             className={`${cellCls} tabular text-right`} />
                    </Td>
                  </tr>
                  {l.trackBatch && (
                    <tr className="border-b border-rule/60 last:border-0 bg-surface-2/40">
                      <td colSpan={5} className="px-3 pb-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                          <LotField label="Dye-lot code" required error={dyeLotErr}>
                            <input value={dyeLotByLine[l.id] ?? ""}
                                   onChange={(e) => setDyeLotByLine((v) => ({ ...v, [l.id]: e.target.value }))}
                                   placeholder="e.g. LOT-2624-A"
                                   className={`${cellCls} tabular uppercase`} />
                          </LotField>
                          <LotField label="Roll count">
                            <input inputMode="numeric" value={rollCountByLine[l.id] ?? ""}
                                   onChange={(e) => setRollCountByLine((v) => ({ ...v, [l.id]: e.target.value }))}
                                   placeholder="3"
                                   className={`${cellCls} tabular text-right`} />
                          </LotField>
                          <LotField label="Bin location">
                            <input value={binByLine[l.id] ?? ""}
                                   onChange={(e) => setBinByLine((v) => ({ ...v, [l.id]: e.target.value }))}
                                   placeholder="e.g. R2-B4"
                                   className={`${cellCls} tabular uppercase`} />
                          </LotField>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="mt-3 text-[12px] text-bad">{error}</div>}

      <div className="mt-4 flex items-center justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)}
                className="h-[34px] px-4 rounded-[8px] text-[12.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending}
                className="h-[34px] px-5 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors">
          {pending ? "Posting…" : "Post GRN"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[34px] px-3 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent";
const cellCls =
  "w-full h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12.5px] outline-none focus:border-accent";

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
function Th({ children, align = "left", width }: { children: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th style={width ? { width } : undefined}
        className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
function LotField({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10.5px] tracking-[0.06em] uppercase text-text-dim">
        {label}{required && <span className="text-accent"> *</span>}
      </div>
      {children}
      {error && <div className="mt-0.5 text-[11px] text-bad">{error}</div>}
    </div>
  );
}
