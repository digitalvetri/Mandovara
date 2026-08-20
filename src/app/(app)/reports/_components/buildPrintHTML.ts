import type { Props } from "./ReportsExportBar";

export function buildPrintHTML({ periodLabel, kpi, leads, ageing, topClients, margins }: Props): string {
  const generated = new Date().toLocaleString("en-IN");
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const kpiItems: { label: string; value: string }[] = [
    { label: "Revenue (ex-GST)",  value: kpi.revenue },
    { label: "Collections",       value: kpi.collections },
    { label: "Outstanding",       value: kpi.outstanding },
    { label: "Active Projects",   value: String(kpi.activeProjects) },
    { label: "New Leads",         value: String(kpi.newLeads) },
    { label: "Ready to Install",  value: String(kpi.readyToInstall) },
  ];

  const leadsHTML = leads.length === 0
    ? `<div class="empty">No leads yet.</div>`
    : leads.map((r) => `<div class="row"><span class="f1">${e(r.label)}</span><span class="num">${r.won}/${r.total}</span><span class="num">${r.convPct}</span></div>`).join("");

  const ageingHTML = ageing.map((b) =>
    `<div class="row"><span class="f1">${e(b.label)}</span><span class="num">${b.count}</span><span class="num" style="color:${b.fromDays > 0 ? "#c0392b" : "#152324"}">${e(b.amount)}</span></div>`,
  ).join("");

  const clientsHTML = topClients.length === 0
    ? `<div class="empty">No invoices yet.</div>`
    : topClients.map((c) => `<div class="row"><span class="f1 trunc">${e(c.name)}</span><span class="num">${c.invoiceCount} inv</span><span class="num">${e(c.revenue)}</span></div>`).join("");

  const marginsHTML = margins.length === 0
    ? `<div class="empty">No projects yet.</div>`
    : margins.map((m) => {
        const num = m.number.split("/").pop() ?? m.number;
        const col = m.positive ? "#2e7d32" : "#c0392b";
        return `<div class="row"><span class="code">${e(num)}</span><span class="f1 trunc">${e(m.name)}</span><span class="num" style="color:${col}">${e(m.margin)}</span><span class="num" style="color:${col}">${m.marginPct}</span></div>`;
      }).join("");

  const CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,-apple-system,sans-serif;color:#152324;background:#fff;font-size:12px}
    .page{padding:40px 48px;max-width:900px;margin:0 auto}
    .hdr{display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #2BA89A;padding-bottom:14px;margin-bottom:24px}
    .hdr h1{font-size:24px;font-weight:700}
    .eyebrow{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#4B5859;margin-bottom:4px}
    .hdr-r{text-align:right;font-size:11px;color:#4B5859}
    .hdr-r strong{display:block;font-size:13px;font-weight:600;color:#152324}
    .kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
    .kc{border:1px solid #e2e8e8;border-radius:8px;padding:10px 12px}
    .kl{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#636F6F;margin-bottom:5px}
    .kv{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .card{border:1px solid #e2e8e8;border-radius:8px;overflow:hidden}
    .ch{padding:8px 12px;background:#f7fafa;border-bottom:1px solid #e2e8e8;font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4B5859}
    .cb{padding:4px 12px}
    .row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f0f4f4}
    .row:last-child{border-bottom:none}
    .f1{flex:1;font-size:11px;min-width:0}
    .trunc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .num{font-variant-numeric:tabular-nums;font-size:11px;color:#4B5859;text-align:right;white-space:nowrap}
    .code{font-size:10px;color:#4B5859;font-variant-numeric:tabular-nums;white-space:nowrap}
    .empty{padding:14px 0;text-align:center;font-size:11px;color:#9CA8A8}
    .foot{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8e8;font-size:9.5px;color:#9CA8A8;text-align:center}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:20px 28px}}
  `;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Mandovara Reports — ${e(periodLabel)}</title><style>${CSS}</style></head>
<body><div class="page">
  <div class="hdr">
    <div><div class="eyebrow">Mandovara · Studio Console</div><h1>Reports</h1></div>
    <div class="hdr-r"><strong>${e(periodLabel)}</strong>${e(today)}</div>
  </div>
  <div class="kpi">${kpiItems.map(({ label, value }) => `<div class="kc"><div class="kl">${e(label)}</div><div class="kv">${e(value)}</div></div>`).join("")}</div>
  <div class="grid">
    <div class="card"><div class="ch">Leads by Source</div><div class="cb">${leadsHTML}</div></div>
    <div class="card"><div class="ch">Outstanding Invoice Ageing</div><div class="cb">${ageingHTML}</div></div>
    <div class="card"><div class="ch">Top Clients by Revenue</div><div class="cb">${clientsHTML}</div></div>
    <div class="card"><div class="ch">Project Margin Snapshot</div><div class="cb">${marginsHTML}</div></div>
  </div>
  <div class="foot">Mandovara · 32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002 · Generated ${e(generated)}</div>
</div></body></html>`;
}

function e(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
