"use client";

// "Record payment" on the project's Payment ledger.
//
// Owner, 2026-08-30: "in payment ledger i need a option to enter the
// recieved payments from here also". Money arrives while you are looking
// at the project, not while you happen to be on the client page — and
// that was the only screen with this control.
//
// Reuses the client page's RecordPaymentModal rather than growing a
// second receipt form: one place decides what a receipt is, how it
// allocates, and which invoices it can settle (CLAUDE.md rule 14).

import { useState } from "react";
import { IndianRupee } from "lucide-react";
import { RecordPaymentModal } from "@/app/(app)/clients/_components/RecordPaymentModal";

export interface OpenInvoiceStub {
  id: string;
  number: string;
  outstanding: string;
}

export function RecordPaymentFromProject({
  clientId, branchId, openInvoices,
}: {
  clientId: string;
  branchId: string;
  openInvoices: OpenInvoiceStub[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-good/40 bg-good/10 px-3 text-[12px] font-medium text-good transition-colors hover:bg-good/20"
      >
        <IndianRupee size={12} strokeWidth={2.2} />
        Record payment
      </button>

      <RecordPaymentModal
        open={open}
        onClose={() => setOpen(false)}
        clientId={clientId}
        branchId={branchId}
        openInvoices={openInvoices}
      />
    </>
  );
}
