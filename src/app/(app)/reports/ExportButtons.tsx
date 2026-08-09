"use client";

export function ExportButtons() {
  return (
    <div className="flex items-center gap-2">
      <a
        href="/api/reports/export"
        className="h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-surface border border-rule text-text-dim hover:text-text inline-flex items-center gap-1.5 transition-colors"
      >
        <DownloadIcon />
        Excel
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-surface border border-rule text-text-dim hover:text-text inline-flex items-center gap-1.5 transition-colors"
      >
        <PrintIcon />
        Print PDF
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="opacity-70">
      <path d="M8 2v8m0 0L5 7m3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="opacity-70">
      <path d="M4 6V2h8v4M4 12H2V6h12v6h-2M4 12v2h8v-2M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
