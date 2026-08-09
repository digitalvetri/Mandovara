"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      className="flex items-center gap-2 h-8 px-3 rounded-md border border-border text-[12px] text-text-muted hover:text-text hover:border-text/30 transition-colors"
      onClick={() => window.print()}
    >
      <Printer size={13} strokeWidth={1.6} />
      Print Cut List
    </button>
  );
}
