// Pure helpers for QuotationHeader — extracted to stay under the 300-line limit.

export function pToINR(paise: string): string {
  try {
    const n = BigInt(paise);
    const r = n / 100n;
    const s = r.toString();
    if (s.length <= 3) return `₹${s}`;
    const l3   = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `₹${rest},${l3}`;
  } catch { return "₹0"; }
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export function digitsOnly(m: string): string { return m.replace(/\D+/g, ""); }

export function shortNum(n: string): string {
  const p = n.split("/");
  return p.length >= 2 ? (p.slice(-1)[0] ?? n) : n;
}

export function effectiveGstRate(cgstStr: string, taxableStr: string): string {
  try {
    const cgst    = Number(BigInt(cgstStr));
    const taxable = Number(BigInt(taxableStr));
    if (taxable === 0) return "0";
    const rate = (cgst / taxable) * 100;
    return Number.isInteger(rate) ? `${rate}` : rate.toFixed(1);
  } catch { return "0"; }
}
