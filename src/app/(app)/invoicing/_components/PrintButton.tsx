"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-rule bg-surface-2 text-text-dim text-[12px] hover:bg-surface hover:text-text transition-colors"
    >
      Print / PDF
    </button>
  );
}
