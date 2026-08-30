"use client";

// "Create invoice" on the project's Payment ledger.
//
// It used to bill the current quotation in one click. The owner asked
// for the opposite (2026-08-30): "i create invoice based on the
// Quotation i want to create invoice by myself" — so it now opens the
// builder, where the quotation's lines are the starting point and every
// field is editable.
//
// createInvoiceFromQuotation is still there and still works; nothing on
// this screen calls it any more.

import Link from "next/link";
import type { Route } from "next";
import { FileText } from "lucide-react";

export function CreateInvoiceLink({ projectId }: { projectId: string }) {
  return (
    <Link
      href={`/invoicing/create?project=${projectId}` as Route}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20"
    >
      <FileText size={12} />
      Create invoice
    </Link>
  );
}
