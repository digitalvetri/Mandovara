"use client";

import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { buildPrintHTML } from "./buildPrintHTML";

// ── Serialisable prop shapes (BigInt converted to ₹ strings server-side)
export interface SerializedKpi {
  revenue: string; collections: string; outstanding: string;
  activeProjects: number; newLeads: number; readyToInstall: number;
}
export interface LeadRow   { source: string; label: string; total: number; won: number; convPct: string }
export interface AgeRow    { label: string; amount: string; count: number; fromDays: number }
export interface ClientRow { name: string; invoiceCount: number; revenue: string }
export interface MarginRow { number: string; name: string; orderValue: string; margin: string; marginPct: string; positive: boolean }

export interface Props {
  periodLabel: string;
  from?:       string;
  to?:         string;
  kpi:         SerializedKpi;
  leads:       LeadRow[];
  ageing:      AgeRow[];
  topClients:  ClientRow[];
  margins:     MarginRow[];
}

export function ReportsExportBar(props: Props) {
  function openPrintWindow() {
    const win = window.open("", "_blank", "width=960,height=800");
    if (!win) return;
    win.document.write(buildPrintHTML(props));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  const qs = new URLSearchParams();
  if (props.from) qs.set("from", props.from);
  if (props.to)   qs.set("to",   props.to);
  const pdfHref = `/api/reports/pdf${qs.toString() ? `?${qs}` : ""}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href="/api/reports/export"
        className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-surface border border-rule text-text-dim hover:text-text transition-colors"
      >
        <FileSpreadsheet size={13} strokeWidth={1.8} />
        Excel
      </a>
      <button
        type="button"
        onClick={openPrintWindow}
        className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-surface border border-rule text-text-dim hover:text-text transition-colors"
      >
        <Printer size={13} strokeWidth={1.8} />
        Print
      </button>
      <a
        href={pdfHref}
        download
        className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-accent text-white hover:opacity-90 transition-colors"
      >
        <FileText size={13} strokeWidth={1.8} />
        Download PDF
      </a>
    </div>
  );
}
