// IST-first datetime kernel. CLAUDE.md India specifics: IST everywhere,
// FY runs April-March, en-IN formatting throughout.
//
// Never use date-fns or moment. Intl + narrow helpers only.

export const IST_TIMEZONE = "Asia/Kolkata";
export const LOCALE = "en-IN";
export const FY_START_MONTH = 4; // April, 1-indexed

// ── Formatting ──────────────────────────────────────────────────
// All formatters lock timezone to IST — otherwise "today" flips at midnight UTC.

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: IST_TIMEZONE, day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}

export function formatDateISO(d: Date): string {
  // yyyy-mm-dd anchored in IST (used for @db.Date columns like Attendance.date)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: IST_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(d);
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} · ${formatTime(d)}`;
}

// ── Financial year ─────────────────────────────────────────────
// India runs FY from 1-April to 31-March. Label format: "26-27".

/** FY label ("26-27") for the given date. Defaults to now, IST-aware. */
export function financialYear(d: Date = new Date()): string {
  const parts = getIstYearMonth(d);
  const y = parts.month >= FY_START_MONTH ? parts.year : parts.year - 1;
  return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`;
}

/** Start of the given FY, midnight IST, as a UTC Date. */
export function fyStart(fy: string): Date {
  const y = parseFyStartYear(fy);
  // April 1st at 00:00 IST = March 31st 18:30 UTC.
  return new Date(Date.UTC(y, FY_START_MONTH - 1, 1) - IST_OFFSET_MS);
}

/** End of the given FY (exclusive upper bound: April 1st next year). */
export function fyEnd(fy: string): Date {
  const y = parseFyStartYear(fy);
  return new Date(Date.UTC(y + 1, FY_START_MONTH - 1, 1) - IST_OFFSET_MS);
}

// ── Ageing buckets — used across outstandings / dashboards ─────

export type AgeingBucket = "0-30" | "31-60" | "61-90" | "90+";

/**
 * Bucket by days overdue. Boundary convention: day 30 → "0-30", day 31 → "31-60".
 * Negative days (not yet due) collapse to "0-30".
 */
export function ageingBucket(daysOverdue: number): AgeingBucket {
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

/** Whole days between two dates, IST-anchored. `to − from`, rounded down. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / MS_PER_DAY);
}

// ── Internals ──────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

interface YearMonth { year: number; month: number }

function getIstYearMonth(d: Date): YearMonth {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE, year: "numeric", month: "2-digit",
  }).formatToParts(d);
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
  };
}

function parseFyStartYear(fy: string): number {
  const m = fy.match(/^(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`bad financialYear label: ${fy} (expected "YY-YY")`);
  return 2000 + Number(m[1]);
}
