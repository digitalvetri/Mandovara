// formatINR — the ONLY currency formatter in the codebase.
// Rule enforced by ESLint: toLocaleString('en-US') is banned in review.
//
// Indian digit grouping (lakhs / crores):
//   ₹ 100        →  ₹100
//   ₹ 1,000      →  ₹1,000
//   ₹ 16,500     →  ₹16,500
//   ₹ 1,00,000   →  ₹1,00,000       (one lakh)
//   ₹ 16,50,000  →  ₹16,50,000
//   ₹ 1,00,00,000→ ₹1,00,00,000     (one crore)
//
// Negatives are wrapped in parentheses and coloured --color-alarm at the
// render site (docs/BUILD-SPEC.md §7.3).

import type { Paise } from "./paise";
import { abs } from "./paise";

export function formatINR(p: Paise): string {
  const isNegative = p < 0n;
  const a = abs(p);
  const rupees = a / 100n;
  const paisePart = a % 100n;
  const rupeesStr = groupIndian(rupees);
  const paiseStr = paisePart === 0n ? "" : `.${paisePart.toString().padStart(2, "0")}`;
  const body = `₹${rupeesStr}${paiseStr}`;
  return isNegative ? `(${body})` : body;
}

/** Same value, minus the "₹" — useful in some tabular cells. */
export function formatINRPlain(p: Paise): string {
  return formatINR(p).replace("₹", "").replace(/[()]/g, "");
}

/** Always called with a non-negative rupees value — sign handled by formatINR. */
function groupIndian(rupees: bigint): string {
  const s = rupees.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  // Group `rest` from the right in pairs
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

// ── parseINR ────────────────────────────────────────────────────
//
// Accepts:
//   "1650000"             →  1,650,000 rupees   = 165 000 000 paise
//   "16,50,000"           →  1,650,000 rupees
//   "1,650,000"           →  1,650,000 rupees   (US grouping tolerated on input)
//   "16.5L", "16.5 lakh"  →  1,650,000 rupees
//   "1.5cr", "1.5 crore"  →  15,000,000 rupees
//   "500k"                →  500,000 rupees
//   "16.50"               →  16 rupees 50 paise
//   "₹1,00,000", "Rs 500" →  strips currency prefix
//   "(500)"               →  −500 rupees
//   number 1650000        →  1,650,000 rupees × 100 = 165 000 000 paise

export function parseINR(input: string | number): Paise {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new ParseError(input, "not finite");
    return BigInt(Math.round(input * 100));
  }
  const original = input;
  let s = input.toString().trim();
  if (s === "") throw new ParseError(original, "empty string");

  let sign = 1;
  const parenMatch = s.match(/^\((.+)\)$/);
  if (parenMatch) { s = parenMatch[1]!; sign = -1; }

  s = s.replace(/[₹]/g, "").replace(/Rs\.?/gi, "").replace(/\bINR\b/gi, "").trim();
  s = s.replace(/,/g, "");
  if (s.startsWith("-")) { sign = -sign; s = s.slice(1); }

  // Suffix multipliers
  const suffixRegex = /^(\d+(?:\.\d+)?)\s*(k|l|lakh|lakhs|cr|crore|crores)$/i;
  const m = s.match(suffixRegex);
  if (m) {
    const n = parseFloat(m[1]!);
    const suffix = m[2]!.toLowerCase();
    const multiplierRupees =
      suffix === "k"                                          ? 1_000
      : suffix === "l" || suffix === "lakh" || suffix === "lakhs" ? 100_000
      :                                                         10_000_000;
    return BigInt(sign) * BigInt(Math.round(n * multiplierRupees * 100));
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new ParseError(original, `unparseable body ${JSON.stringify(s)}`);
  }
  const asNum = parseFloat(s);
  return BigInt(sign) * BigInt(Math.round(asNum * 100));
}

export class ParseError extends Error {
  constructor(input: unknown, reason: string) {
    super(`parseINR(${JSON.stringify(input)}): ${reason}`);
    this.name = "ParseError";
  }
}
