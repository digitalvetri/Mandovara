// Sync helpers moved out of actions-part2.ts: a "use server" file may only
// export async functions.

import type { z } from "zod";
import { parseINR } from "@/kernel/money/format";
import { ActionResult } from "./actions";

export function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

export function parsePaise(v: string): bigint | null {
  try { return parseINR(v); } catch { return null; }
}
