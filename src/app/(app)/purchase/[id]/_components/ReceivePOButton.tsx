"use client";

// Replaces the multi-line, dye-lot GRN form for the everyday case: the
// vendor delivered, mark the whole PO received in one step. Posts stock
// and raises the vendor-payment expense (with GST) server-side — see
// modules/purchase/actions-receive.ts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receivePO } from "@/modules/purchase/actions-receive";

interface Props {
  poId:       string;
  vendorName: string;
}

export function ReceivePOButton({ poId, vendorName }: Props) {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [pending, start]          = useTransition();

  function handleReceive() {
    setError(null);
    start(async () => {
      const res = await receivePO({ id: poId, vendorInvoiceNo: invoiceNo.trim() || undefined });
      if (!res.ok) { setError(res.error ?? "Could not mark this PO as received"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-5 py-3.5 flex items-center justify-between gap-6">
        <div className="text-[12.5px] text-text-dim leading-snug">
          Goods arrived from {vendorName}?
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-[34px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          Mark as received
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule px-5 py-4 space-y-3">
      <div className="text-[12.5px] text-text">
        This marks every line on the PO as fully received, adds it to stock, and raises what
        you owe the vendor in To Pay — the payment itself is still marked separately once it
        actually goes out. Use this once the delivery is complete.
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-text-dim" htmlFor="recv-invoice-no">
          Vendor invoice no. (optional)
        </label>
        <input
          id="recv-invoice-no"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="e.g. INV/2026-27/0048"
          maxLength={80}
          className="w-full max-w-[280px] h-9 px-2.5 rounded-[6px] border border-rule bg-transparent text-[12.5px] outline-none focus:border-accent transition-colors"
        />
      </div>
      {error && <div className="text-[12px] text-fault">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReceive}
          disabled={pending}
          className="h-[34px] px-5 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Receiving…" : "Confirm — mark as received"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={pending}
          className="h-[34px] px-4 rounded-[8px] border border-rule text-text-dim text-[12.5px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
