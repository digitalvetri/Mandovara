"use client";

import { useState, useMemo } from "react";
import { X, FileText, Printer, Download } from "lucide-react";
import { buildInvoicePrintHTML } from "./buildInvoicePrintHTML";

export interface SerializedLine {
  id: string;
  lineNo: number;
  description: string;
  hsn: string;
  quantity: string;
  unit: string;
  rate: string;
  taxable: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  amount: string;
}

export interface SerializedInvoice {
  id: string;
  number: string;
  type: string;
  status: string;
  clientName: string;
  clientMobile: string;
  clientGstin: string | null;
  branchName: string;
  supplierStateCode: string;
  placeOfSupplyCode: string;
  date: string;
  dueDate: string;
  orderNumber: string | null;
  isIntra: boolean;
  taxableAmount: string;
  cgst: string;
  sgst: string;
  igst: string;
  roundOff: string;
  roundOffNonZero: boolean;
  total: string;
  advanceAdjusted: string;
  paidTotal: string;
  outstanding: string;
  hasAdv: boolean;
  hasPaid: boolean;
  lines: SerializedLine[];
}

export function InvoicePDFPreviewButton({ invoice }: { invoice: SerializedInvoice }) {
  const [open, setOpen] = useState(false);
  const html = useMemo(() => buildInvoicePrintHTML(invoice), [invoice]);

  function openPrintWindow() {
    const win = window.open("", "_blank", "width=960,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-rule bg-surface-2 text-text-dim text-[12px] hover:bg-surface hover:text-text transition-colors"
      >
        <FileText size={13} strokeWidth={1.8} />
        Download PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-[4px]"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-surface border-b border-rule px-6 py-3 shrink-0">
              <div>
                <div className="text-[14px] font-semibold text-text">Invoice Preview</div>
                <div className="text-[11px] text-text-dim">
                  {invoice.number} · {invoice.clientName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openPrintWindow}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-rule bg-surface-2 text-[12px] font-medium text-text-dim hover:bg-surface hover:text-text transition-colors"
                >
                  <Printer size={13} strokeWidth={1.8} />
                  Print / Save as PDF
                </button>
                <a
                  href={`/api/invoicing/${invoice.id}/pdf`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 transition-colors"
                >
                  <Download size={13} strokeWidth={1.8} />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-[8px] border border-rule text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Iframe preview — completely isolated CSS */}
            <div className="flex-1 overflow-hidden bg-ink/20 py-6 px-4 flex justify-center">
              <iframe
                srcDoc={html}
                title="Invoice PDF Preview"
                className="w-full h-full bg-white shadow-lg"
                style={{ maxWidth: 900, border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
