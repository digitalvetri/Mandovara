"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postGRN } from "@/modules/purchase/grn-actions-part2";
import type { POLineRow } from "@/modules/purchase/queries";

interface LineState {
  quantity: string;
  binLocation: string;
}

interface Props {
  purchaseOrderId: string;
  lines: POLineRow[];
}

export function GRNForm({ purchaseOrderId, lines }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string>(iso(new Date()));
  const [invoiceRef, setInvoiceRef] = useState<string>("");
  const [stateByLine, setStateByLine] = useState<Record<string, LineState>>({});

  const pendingLines = lines.filter((l) => parseFloat(l.pendingQty) > 0);
  if (pendingLines.length === 0) return null;

  function lineState(id: string): LineState {
    return stateByLine[id] ?? { quantity: "", binLocation: "" };
  }
  function updateLine(id: string, patch: Partial<LineState>) {
    setStateByLine((s) => ({ ...s, [id]: { ...lineState(id), ...patch } }));
  }

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const linesPayload = pendingLines
      .map((l) => {
        const st = lineState(l.id);
        const qty = Number(st.quantity ?? 0);
        if (qty <= 0) return null;
        return {
          colourwayId:  l.colourwayId,
          quantity:     qty,
          binLocation:  st.binLocation || undefined,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (linesPayload.length === 0) {
      setError("Enter a quantity on at least one line.");
      return;
    }
    startTransition(async () => {
      const res = await postGRN({
        purchaseOrderId,
        receivedAt,
        invoiceRef: invoiceRef || undefined,
        lines: linesPayload,
      });
      if (!res.ok) { setError(res.error ?? "Could not post GRN"); return; }
      setOpen(false);
      setStateByLine({});
      setInvoiceRef("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule p-4 flex items-center justify-between">
        <div className="text-[12.5px] text-text-muted">
          {pendingLines.length} line{pendingLines.length === 1 ? "" : "s"} pending receipt.
        </div>
        <button type="button" onClick={() => setOpen(true)}
                className="h-[32px] px-4 rounded-[8px] bg-gold text-ink text-[12px] font-medium hover:bg-gold-strong transition-colors">
          Post GRN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={commit} className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Received on" required>
          <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)}
                 className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Vendor invoice ref">
          <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)}
                 placeholder="e.g. INV-2024-882"
                 className={`${fieldCls} tabular`} />
        </Field>
      </div>

      <div className="border border-rule rounded-[8px] overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
              <Th>Colourway</Th>
              <Th align="right">Pending</Th>
              <Th align="right" width={110}>Receive now</Th>
              <Th width={110}>Bin</Th>
            </tr>
          </thead>
          <tbody>
            {pendingLines.map((l) => (
              <tr key={l.id} className="border-b border-rule/60 last:border-0">
                <Td>
                  <div className="tabular text-text text-[12.5px]">{l.colourwayCode}</div>
                  <div className="text-[11.5px] text-text-muted">{l.colourName} · {l.designCode}</div>
                </Td>
                <Td align="right">
                  <span className="tabular text-text">
                    {l.pendingQty} <span className="text-text-subtle text-[10.5px]">{l.unit}</span>
                  </span>
                </Td>
                <Td align="right">
                  <input inputMode="decimal"
                    value={lineState(l.id).quantity}
                    onChange={(e) => updateLine(l.id, { quantity: e.target.value })}
                    placeholder="0"
                    className={`${cellCls} tabular text-right`} />
                </Td>
                <Td>
                  <input
                    value={lineState(l.id).binLocation}
                    onChange={(e) => updateLine(l.id, { binLocation: e.target.value })}
                    placeholder="A-3"
                    className={`${cellCls} tabular`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="mt-3 text-[12px] text-fault">{error}</div>}

      <div className="mt-4 flex items-center justify-end gap-3">
        <button type="button" onClick={() => setOpen(false)}
                className="h-[34px] px-4 rounded-[8px] text-[12.5px] text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={pending}
                className="h-[34px] px-5 rounded-[8px] bg-gold text-ink text-[12px] font-medium hover:bg-gold-strong disabled:opacity-60 transition-colors">
          {pending ? "Posting…" : "Post GRN"}
        </button>
      </div>
    </form>
  );
}

const fieldCls = "w-full h-[34px] px-3 bg-surface-2 border border-border rounded-[6px] text-[12.5px] outline-none focus:border-gold";
const cellCls  = "w-full h-[28px] px-2 bg-surface-2 border border-border rounded-[4px] text-[12.5px] outline-none focus:border-gold";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] tracking-[0.06em] uppercase text-text-muted">
        {label}{required && <span className="text-gold"> *</span>}
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
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
