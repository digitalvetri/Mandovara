import type { SerializedInvoice } from "./InvoicePDFPreviewButton";

const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

function e(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildInvoicePrintHTML(inv: SerializedInvoice): string {
  const typeLabel = inv.type === "TAX" ? "TAX INVOICE" : inv.type.replace(/_/g, " ");
  const { isIntra } = inv;

  const gstTh = isIntra
    ? `<th class="r">CGST%</th><th class="r">CGST</th><th class="r">SGST</th>`
    : `<th class="r">GST%</th><th class="r">IGST</th>`;

  const lineRows = inv.lines.map((l, i) => {
    const bg = i % 2 === 1 ? ` style="background:#F8FAFC"` : "";
    const gstCols = isIntra
      ? `<td class="r muted">${e(l.gstRate)}%</td><td class="r">${e(l.cgst)}</td><td class="r">${e(l.sgst)}</td>`
      : `<td class="r muted">${e(l.gstRate)}%</td><td class="r">${e(l.igst)}</td>`;
    const unit = UNIT_SHORT[l.unit] ?? l.unit.toLowerCase();
    return `<tr${bg}><td class="ctr">${l.lineNo}</td><td class="desc">${e(l.description)}<div class="muted xs">${e(l.hsn)}</div></td><td class="r">${e(l.quantity)} <span class="muted">${unit}</span></td><td class="r">${e(l.rate)}</td><td class="r">${e(l.taxable)}</td>${gstCols}<td class="r bold">${e(l.amount)}</td></tr>`;
  }).join("");

  const taxRows = [
    `<div class="tr2"><span class="tk">Taxable Amount</span><span class="tv">${e(inv.taxableAmount)}</span></div>`,
    ...(isIntra
      ? [`<div class="tr2"><span class="tk">CGST</span><span class="tv">${e(inv.cgst)}</span></div>`,
         `<div class="tr2"><span class="tk">SGST</span><span class="tv">${e(inv.sgst)}</span></div>`]
      : [`<div class="tr2"><span class="tk">IGST</span><span class="tv">${e(inv.igst)}</span></div>`]),
    ...(inv.roundOffNonZero ? [`<div class="tr2"><span class="tk">Round-off</span><span class="tv">${e(inv.roundOff)}</span></div>`] : []),
  ].join("");

  const outSection = (inv.hasAdv || inv.hasPaid) ? `
    <div class="out">
      ${inv.hasAdv ? `<div class="tr2"><span class="tk">Advance adjusted</span><span class="tv">${e(inv.advanceAdjusted)}</span></div>` : ""}
      ${inv.hasPaid ? `<div class="tr2"><span class="tk">Received</span><span class="tv">${e(inv.paidTotal)}</span></div>` : ""}
      <div class="tr2"><span class="tk bold dark">Outstanding</span><span class="tv bold dark">${e(inv.outstanding)}</span></div>
    </div>` : "";

  const CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Helvetica,Arial,sans-serif;font-size:9pt;color:#111827;background:#fff}
    .page{max-width:860px;margin:0 auto;padding:32px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1B8A7E;padding-bottom:12px;margin-bottom:14px}
    .logo{width:34px;height:34px;background:#1B8A7E;border-radius:5px;color:#fff;font-size:20px;font-weight:bold;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .brand-row{display:flex;align-items:center;gap:10px}
    .brand-name{font-size:16pt;font-weight:bold;line-height:1}
    .brand-sub{font-size:6.5pt;color:#64748B;letter-spacing:2px;margin-top:4px}
    .doc-right{text-align:right}
    .doc-title{font-size:13pt;font-weight:bold;color:#1B8A7E;letter-spacing:1.5px}
    .doc-num{font-family:Courier,monospace;font-size:8.5pt;color:#64748B;margin-top:3px}
    .doc-sub{font-size:7.5pt;color:#64748B;margin-top:2px}
    .meta{display:flex;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:3px;padding:8px 12px;margin-bottom:12px}
    .mc{flex:1}.ml{font-size:6.5pt;color:#64748B;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
    .mv{font-size:8.5pt;font-weight:bold}
    .addr-row{display:flex;gap:10px;margin-bottom:12px}
    .addr{flex:1;border:1px solid #E2E8F0;border-radius:3px;padding:10px;background:#F8FAFC}
    .addr-t{font-size:6.5pt;font-weight:bold;color:#1B8A7E;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}
    .addr-n{font-size:9.5pt;font-weight:bold;margin-bottom:2px}
    .addr-l{font-size:7.5pt;color:#64748B;margin-top:1px}
    .addr-m{font-family:Courier,monospace;font-size:7.5pt;color:#64748B;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    thead tr{background:#1B8A7E}
    th{color:#fff;font-size:6.5pt;letter-spacing:.8px;padding:5px 4px;font-weight:bold}
    td{font-size:8pt;padding:4px;border-bottom:.5px solid #E2E8F0;vertical-align:top}
    .ctr{text-align:center;color:#64748B;width:18px}
    .desc{min-width:120px}
    .r{text-align:right;font-family:Courier,monospace;white-space:nowrap}
    .muted{color:#64748B}.xs{font-size:7pt}.bold{font-weight:bold}.dark{color:#111827}
    .totals{display:flex;justify-content:flex-end;margin-bottom:12px}
    .tot-inner{width:250px}
    .tr2{display:flex;justify-content:space-between;padding:3px 0;border-bottom:.5px solid #E2E8F0;font-size:8pt}
    .tk{color:#64748B}.tv{font-family:Courier,monospace}
    .grand{display:flex;justify-content:space-between;align-items:center;background:#1B8A7E;color:#fff;padding:7px 10px;border-radius:3px;margin-top:8px}
    .grand-k{font-size:8pt;font-weight:bold;letter-spacing:1px}
    .grand-v{font-size:13pt;font-family:Courier,monospace;font-weight:bold}
    .out{margin-top:8px;border-top:1px solid #E2E8F0;padding-top:6px}
    .foot{margin-top:28px;padding-top:8px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:7pt;color:#64748B}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:20px}}
  `;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${e(typeLabel)} ${e(inv.number)}</title><style>${CSS}</style></head>
<body><div class="page">
  <div class="hdr">
    <div class="brand-row"><div class="logo">M</div><div><div class="brand-name">Mandovara</div><div class="brand-sub">INTERIORS  ·  COIMBATORE</div></div></div>
    <div class="doc-right"><div class="doc-title">${e(typeLabel)}</div><div class="doc-num">${e(inv.number)}</div>${inv.orderNumber ? `<div class="doc-sub">Order ${e(inv.orderNumber)}</div>` : ""}</div>
  </div>
  <div class="meta">
    <div class="mc"><div class="ml">Invoice No.</div><div class="mv" style="font-family:Courier,monospace">${e(inv.number)}</div></div>
    <div class="mc"><div class="ml">Date</div><div class="mv">${e(inv.date)}</div></div>
    <div class="mc"><div class="ml">Due</div><div class="mv">${e(inv.dueDate)}</div></div>
    <div class="mc"><div class="ml">Status</div><div class="mv">${e(inv.status)}</div></div>
  </div>
  <div class="addr-row">
    <div class="addr"><div class="addr-t">Bill To</div><div class="addr-n">${e(inv.clientName)}</div><div class="addr-l">${e(inv.clientMobile)}</div>${inv.clientGstin ? `<div class="addr-m">GSTIN: ${e(inv.clientGstin)}</div>` : ""}</div>
    <div class="addr"><div class="addr-t">From</div><div class="addr-n">${e(inv.branchName)}</div><div class="addr-l">32 Thirumoorthy Layout, Thadagam Rd</div><div class="addr-l">RS Puram, Coimbatore 641002</div><div class="addr-l">State ${e(inv.supplierStateCode)} · ${isIntra ? "Intra-state" : "Inter-state"}</div></div>
  </div>
  <table>
    <thead><tr><th class="ctr">#</th><th style="text-align:left">Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th>${gstTh}<th class="r">Amount</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div class="totals"><div class="tot-inner">${taxRows}<div class="grand"><span class="grand-k">INVOICE TOTAL</span><span class="grand-v">${e(inv.total)}</span></div>${outSection}</div></div>
  <div class="foot"><span>mandovara.com  ·  +91 8940430051</span><span>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</span></div>
</div></body></html>`;
}
