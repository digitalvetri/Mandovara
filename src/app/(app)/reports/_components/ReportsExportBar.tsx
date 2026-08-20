"use client";

import { useState } from "react";
import { X, FileSpreadsheet, FileText, Printer } from "lucide-react";
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
  kpi:         SerializedKpi;
  leads:       LeadRow[];
  ageing:      AgeRow[];
  topClients:  ClientRow[];
  margins:     MarginRow[];
}

export function ReportsExportBar(props: Props) {
  const [preview, setPreview] = useState(false);

  function openPrintWindow() {
    const win = window.open("", "_blank", "width=960,height=800");
    if (!win) return;
    win.document.write(buildPrintHTML(props));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  return (
    <>
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
          onClick={() => setPreview(true)}
          className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-surface border border-rule text-text-dim hover:text-text transition-colors"
        >
          <FileText size={13} strokeWidth={1.8} />
          Download PDF
        </button>
      </div>

      {/* ── PDF Preview modal ──────────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-[4px]" onClick={() => setPreview(false)} />

          <div className="relative z-10 flex flex-col h-full max-h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-surface border-b border-rule px-6 py-3 shrink-0">
              <div>
                <div className="text-[14px] font-semibold text-text">PDF Preview</div>
                <div className="text-[11px] text-text-dim">{props.periodLabel} · Mandovara Reports</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openPrintWindow}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-accent text-[12.5px] font-medium text-white hover:opacity-90 transition-colors"
                >
                  <Printer size={13} />
                  Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-[8px] border border-rule text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Scrollable preview */}
            <div className="flex-1 overflow-y-auto bg-ink/20 py-8 px-4 flex justify-center">
              <div className="bg-white shadow-lg w-full" style={{ maxWidth: 900, minHeight: 1100, fontFamily: "Inter, sans-serif", color: "#152324" }}>
                <PreviewContent {...props} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── In-modal React preview (mirrors the print HTML layout)
function PreviewContent({ periodLabel, kpi, leads, ageing, topClients, margins }: Props) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const kpiItems = [
    { label: "Revenue (ex-GST)",  value: kpi.revenue },
    { label: "Collections",       value: kpi.collections },
    { label: "Outstanding",       value: kpi.outstanding },
    { label: "Active Projects",   value: String(kpi.activeProjects) },
    { label: "New Leads",         value: String(kpi.newLeads) },
    { label: "Ready to Install",  value: String(kpi.readyToInstall) },
  ];
  return (
    <div style={{ padding: "40px 48px" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #2BA89A", paddingBottom: 16, marginBottom: 28, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4B5859", marginBottom: 4 }}>Mandovara · Studio Console</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#152324" }}>Reports</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#4B5859" }}>
          <strong style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#152324" }}>{periodLabel}</strong>
          {today}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {kpiItems.map(({ label, value }) => (
          <div key={label} style={{ border: "1px solid #e2e8e8", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#636F6F", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 2-col data grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <PCard title="Leads by Source">
          {leads.length === 0 ? <PEmpty /> : leads.map((r) => (
            <PRow key={r.source}>
              <span style={{ flex: 1, fontSize: 11 }}>{r.label}</span>
              <span style={{ width: 48, textAlign: "right", fontSize: 11, color: "#4B5859", fontVariantNumeric: "tabular-nums" }}>{r.won}/{r.total}</span>
              <span style={{ width: 36, textAlign: "right", fontSize: 11, color: "#4B5859", fontVariantNumeric: "tabular-nums" }}>{r.convPct}</span>
            </PRow>
          ))}
        </PCard>

        <PCard title="Outstanding Invoice Ageing">
          {ageing.length === 0 ? <PEmpty text="All settled." /> : ageing.map((b) => (
            <PRow key={b.label}>
              <span style={{ flex: 1, fontSize: 11 }}>{b.label}</span>
              <span style={{ width: 28, textAlign: "right", fontSize: 11, color: "#4B5859", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
              <span style={{ width: 90, textAlign: "right", fontSize: 11, fontVariantNumeric: "tabular-nums", color: b.fromDays > 0 ? "#c0392b" : "#152324" }}>{b.amount}</span>
            </PRow>
          ))}
        </PCard>

        <PCard title="Top Clients by Revenue">
          {topClients.length === 0 ? <PEmpty /> : topClients.map((c) => (
            <PRow key={c.name}>
              <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span style={{ width: 36, textAlign: "right", fontSize: 11, color: "#4B5859" }}>{c.invoiceCount}</span>
              <span style={{ width: 90, textAlign: "right", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{c.revenue}</span>
            </PRow>
          ))}
        </PCard>

        <PCard title="Project Margin Snapshot">
          {margins.length === 0 ? <PEmpty /> : margins.map((m) => (
            <PRow key={m.number}>
              <span style={{ width: 64, fontSize: 10, color: "#4B5859", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{m.number.split("/").pop()}</span>
              <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
              <span style={{ width: 80, textAlign: "right", fontSize: 11, fontVariantNumeric: "tabular-nums", color: m.positive ? "#2e7d32" : "#c0392b" }}>{m.margin}</span>
              <span style={{ width: 32, textAlign: "right", fontSize: 10, color: m.positive ? "#2e7d32" : "#c0392b" }}>{m.marginPct}</span>
            </PRow>
          ))}
        </PCard>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #e2e8e8", fontSize: 10, color: "#9CA8A8", textAlign: "center" }}>
        Mandovara · 32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002
      </div>
    </div>
  );
}

function PCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8e8", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8e8", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4B5859", background: "#f7fafa" }}>
        {title}
      </div>
      <div style={{ padding: "4px 12px" }}>{children}</div>
    </div>
  );
}

function PRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f0f4f4" }}>{children}</div>;
}

function PEmpty({ text = "No data yet." }: { text?: string }) {
  return <div style={{ padding: "14px 0", textAlign: "center", fontSize: 11, color: "#9CA8A8" }}>{text}</div>;
}
