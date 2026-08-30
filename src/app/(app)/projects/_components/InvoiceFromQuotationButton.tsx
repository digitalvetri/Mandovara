"use client";

// "Create invoice" on the project page, from a quotation.
//
// Owner, 2026-08-30: "creating invoice should be direct from this
// project page ... i dont want to follow a flow i just want to do
// anythings whenever i need". Before this, the only route to an invoice
// was through a confirmed order, so a project with a perfectly good
// quotation on it showed "No projects ready to invoice".
//
// Picks the newest non-rejected quotation when there is more than one —
// that is the current price. When several exist the button says which
// it will use, because silently invoicing the wrong revision is a much
// worse failure than an extra line of text.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FileText, Loader2 } from "lucide-react";
import { createInvoiceFromQuotation } from "@/modules/invoices/actions-from-quotation";

export interface QuotationStub {
  id:     string;
  number: string;
  status: string;
}

export function InvoiceFromQuotationButton({ quotations }: { quotations: QuotationStub[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const usable = quotations.filter((q) => q.status !== "REJECTED");
  if (usable.length === 0) return null;

  const chosen = usable[0]!;

  function go() {
    setError(null);
    start(async () => {
      const r = await createInvoiceFromQuotation({ quotationId: chosen.id });
      if (!r.ok || !r.data) { setError(r.error ?? "Could not create the invoice."); return; }
      router.push(`/invoicing/${r.data.id}` as Route);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); go(); }}
        disabled={pending}
        title={`Bills the lines on ${chosen.number}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        Create invoice
      </button>
      {usable.length > 1 && (
        <span className="text-[10.5px] text-text-dim">from {chosen.number}</span>
      )}
      {error && (
        <span className="max-w-[280px] text-right text-[11px] text-heat" role="alert">{error}</span>
      )}
    </div>
  );
}
