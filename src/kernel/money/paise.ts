// Money arithmetic. Twelve Rules #2:
//   "Money is BigInt paise. Never Float, never Number for currency.
//    Formatting happens at the render boundary and nowhere else."
//
// All operations are exact. Rounding is EXPLICIT and half-up per Indian
// GST rules (docs/BUILD-SPEC.md §10.1).

import { Prisma } from "@prisma/client";

/** All money in the app is BigInt paise. */
export type Paise = bigint;

/** Rupees → Paise. Accepts a JS number or a string like "16.50". */
export function rupees(n: number | string): Paise {
  if (typeof n === "number") {
    if (!Number.isFinite(n)) throw new Error(`rupees(${n}): not a finite number`);
    return BigInt(Math.round(n * 100));
  }
  const trimmed = n.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`rupees(${JSON.stringify(n)}): not a rupee-formatted string`);
  }
  const asNum = Number(trimmed);
  return BigInt(Math.round(asNum * 100));
}

export function paise(n: number | bigint | string): Paise {
  if (typeof n === "bigint") return n;
  if (typeof n === "number") {
    if (!Number.isInteger(n)) throw new Error(`paise(${n}): must be an integer`);
    return BigInt(n);
  }
  return BigInt(n);
}

/** Variadic add. Accepts any number of Paise, returns Paise. */
export function add(...values: readonly Paise[]): Paise {
  let sum = 0n;
  for (const v of values) sum += v;
  return sum;
}

export function subtract(a: Paise, b: Paise): Paise {
  return a - b;
}

/**
 * Multiply a per-unit rate (paise) by a quantity (Decimal with up to 4
 * fractional digits per schema). Result rounded half-up to the nearest paisa.
 *
 * Accepts Decimal, string ("2.500"), or number (up to 4 fractional digits).
 */
export function multiplyByQuantity(rate: Paise, quantity: Prisma.Decimal | string | number): Paise {
  const qtyStr =
    typeof quantity === "string" ? quantity
    : typeof quantity === "number" ? quantity.toString()
    : quantity.toString();

  if (!/^-?\d+(\.\d+)?$/.test(qtyStr)) {
    throw new Error(`multiplyByQuantity: bad quantity ${qtyStr}`);
  }

  const [whole, frac = ""] = qtyStr.split(".");
  const fracDigits = frac.length;
  const scale = 10n ** BigInt(fracDigits);
  const qtyScaled = BigInt(whole! + frac);

  // rate * qtyScaled has units of paise * scale. Divide back with round-half-up.
  return roundHalfUpDivide(rate * qtyScaled, scale);
}

/**
 * amount × percent%, rounded half-up to the nearest paisa. Used for
 * per-line discount and GST calculations.
 */
export function percentage(amount: Paise, percent: number): Paise {
  // Basis points (×100) so a 12.5 % rate is exact-representable.
  const bp = BigInt(Math.round(percent * 100));
  return roundHalfUpDivide(amount * bp, 10_000n);
}

/**
 * Round a paise value to the nearest whole rupee (nearest 100 paise), half-up.
 * Returns both the rounded value AND the adjustment (rounded − original).
 * The adjustment is what shows as the "round-off" line on an Indian invoice.
 * Bounded to ±₹0.50 (±50 paise).
 */
export function roundToRupee(p: Paise): { rounded: Paise; adjustment: Paise } {
  const rounded = roundHalfUpDivide(p, 100n) * 100n;
  return { rounded, adjustment: rounded - p };
}

/**
 * Integer division with round-half-up on the remainder.
 * Handles negative numerators (rounds away from zero on 0.5 boundary).
 */
export function roundHalfUpDivide(num: bigint, denom: bigint): bigint {
  if (denom <= 0n) throw new Error(`roundHalfUpDivide: denom must be positive, got ${denom}`);
  if (num >= 0n) return (num + denom / 2n) / denom;
  return -((-num + denom / 2n) / denom);
}

/** Absolute value in Paise. */
export function abs(p: Paise): Paise {
  return p < 0n ? -p : p;
}
