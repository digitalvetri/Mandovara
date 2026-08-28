"use client";

// [Export] — downloads the invoice list as CSV.
//
// Carries the current search / status / sort straight through to the
// export route, so what lands in the spreadsheet is what the operator
// was looking at, across every page and not just the visible one.

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

export function ExportInvoicesButton() {
  const params = useSearchParams();
  const qs = params.toString();

  return (
    <a
      href={`/api/invoicing/export${qs ? `?${qs}` : ""}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-4 py-2 text-[12.5px] font-medium text-text-dim transition-colors hover:border-gold hover:text-text"
    >
      <Download size={13} strokeWidth={2} />
      Export
    </a>
  );
}
