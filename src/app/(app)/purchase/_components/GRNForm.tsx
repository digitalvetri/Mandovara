"use client";

// Inline "Post GRN" form under a Purchase Order detail. Enter received qty
// per pending line + warehouse. Server posts to the stock ledger, ratchets
// receivedQty, and updates PO status.

import { useState, useTransition } from "react";
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

  const pendingLines = lines.filter((l) => parseFloat(l.pendingQty) > 0);
  if (pendingLines.length === 0) return null;

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const linesPayload = pendingLines
      .map((l) => ({ poLineId: l.id, quantity: Number(qtyByLine[l.id] ?? 0) }))
      .filter((l) => l.quantity > 0);
    if (linesPayload.length === 0) { setError("Enter a quantity on at least one line."); return; }
    startTransition(async () => {
      const res = await postGRN({
        purchaseOrderId, warehouseId, receivedAt,
        vehicleNumber, invoiceRef, lines: linesPayload,
      });
      if (!res.ok) { setError(res.error ?? "Could not post GRN"); return; }
      setOpen(false);
      setQtyByLine({});
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
            {pendingLines.map((l) => (
              <tr key={l.id} className="border-b border-rule/60 last:border-0">
                <Td>
                  <div className="tabular text-text-dim text-[11.5px]">{l.productCode}</div>
                  <div className="text-text">{l.description}</div>
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
            ))}
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
