// Turning what a real spreadsheet holds into what the database needs.
//
// Split out of import-parser (2026-08-28) both for the 300-line ceiling
// and because this is the part that decides whether ten years of books
// arrive intact. Every function here is pure and separately tested — a
// silently mis-parsed mobile number merges two customers, and a
// mis-parsed amount misstates an order value, and neither throws.

import type { ClientTypeName } from "./import-types";

export const CLIENT_TYPES = [
  "HOMEOWNER", "ARCHITECT", "INTERIOR_DESIGNER", "BUILDER",
  "COMMERCIAL", "GOVERNMENT", "DEALER",
] as const;

// Their books will not use our enum names. Map the words a person would
// actually type; anything unrecognised falls back to HOMEOWNER with a
// warning rather than rejecting the whole row.
export const TYPE_ALIASES: Record<string, ClientTypeName> = {
  "homeowner": "HOMEOWNER", "home owner": "HOMEOWNER", "individual": "HOMEOWNER",
  "residential": "HOMEOWNER", "customer": "HOMEOWNER", "retail": "HOMEOWNER",
  "architect": "ARCHITECT",
  "interior designer": "INTERIOR_DESIGNER", "designer": "INTERIOR_DESIGNER",
  "interior": "INTERIOR_DESIGNER",
  "builder": "BUILDER", "contractor": "BUILDER", "developer": "BUILDER",
  "commercial": "COMMERCIAL", "office": "COMMERCIAL", "corporate": "COMMERCIAL",
  "government": "GOVERNMENT", "govt": "GOVERNMENT",
  "dealer": "DEALER", "distributor": "DEALER",
};

export const STAGE_ALIASES: Record<string, string> = {
  "enquiry": "ENQUIRY", "lead": "ENQUIRY", "new": "ENQUIRY",
  "site visit": "SITE_VISIT", "visit": "SITE_VISIT",
  "measurement": "MEASUREMENT", "measured": "MEASUREMENT",
  "quotation": "QUOTATION", "quoted": "QUOTATION", "quote": "QUOTATION",
  "ordered": "ORDERED", "order": "ORDERED", "confirmed": "ORDERED",
  "procurement": "PROCUREMENT", "purchase": "PROCUREMENT",
  "make": "MAKE", "production": "MAKE", "stitching": "MAKE",
  "completed": "COMPLETED", "complete": "COMPLETED", "done": "COMPLETED",
  "delivered": "COMPLETED", "installed": "COMPLETED", "closed": "COMPLETED",
  "cancelled": "CANCELLED", "canceled": "CANCELLED", "lost": "CANCELLED",
};

/** Header keys vary wildly between exports — normalise before matching. */
export function norm(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

export function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Indian mobile numbers, however they were typed.
 *
 * Their books will hold "98430 12345", "+91-9843012345", "09843012345"
 * and occasionally a number Excel helpfully turned into 9.843012345e9.
 * All of those are the same person, and the mobile is the identity this
 * system logs in and matches clients by — so getting it wrong merges or
 * splits real customers.
 */
export function normaliseMobile(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let raw = String(v).trim();
  // Excel scientific notation for a long number.
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(raw)) raw = BigInt(Math.round(Number(raw))).toString();
  const digits = raw.replace(/\D+/g, "");

  let subscriber: string | null = null;
  if (digits.length === 10) subscriber = digits;
  else if (digits.length === 12 && digits.startsWith("91")) subscriber = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) subscriber = digits.slice(1);
  if (subscriber === null) return null;

  // Indian mobile numbers begin 6-9. Without this check a Coimbatore
  // landline written "0422 2345678" strips its leading zero to eleven
  // digits and is accepted as the mobile "+914222345678" — a number that
  // cannot receive the WhatsApp quotation, and which would be silently
  // stored as a client's contact. Better to reject the row and have
  // someone look at it.
  if (!/^[6-9]/.test(subscriber)) return null;

  return `+91${subscriber}`;
}

/**
 * Rupees to paise, from whatever the sheet holds.
 *
 * Accepts 150000, "1,50,000", "₹1,50,000.50", "1.5 L". Returns paise as a
 * BigInt because money is BigInt paise everywhere in this system
 * (CLAUDE.md §0.4) and a float here would round someone's order value.
 */
export function parseRupeesToPaise(v: unknown): bigint | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (typeof v === "number") return BigInt(Math.round(v * 100));
  let s = String(v).trim().replace(/[₹,\s]/g, "");
  // "1.5L" / "2.4 lakh" / "1cr" appear in hand-kept books.
  const lakh = /^(\d+(?:\.\d+)?)(l|lac|lakh|lakhs)$/i.exec(s);
  if (lakh) return BigInt(Math.round(parseFloat(lakh[1]!) * 100_000 * 100));
  const crore = /^(\d+(?:\.\d+)?)(cr|crore|crores)$/i.exec(s);
  if (crore) return BigInt(Math.round(parseFloat(crore[1]!) * 10_000_000 * 100));
  s = s.replace(/[^\d.-]/g, "");
  if (s === "" || Number.isNaN(Number(s))) return null;
  return BigInt(Math.round(Number(s) * 100));
}

/** Excel serial dates and ordinary text dates both appear in real exports. */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel epoch: day 1 is 1900-01-01, with the well-known 1900 leap-year bug.
    const ms = (v - 25_569) * 86_400_000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  // Prefer dd/mm/yyyy — an Indian book means 03/04/2026 as 3 April.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = yy!.length === 2 ? 2000 + Number(yy) : Number(yy);
    const d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

