// Sync helpers moved out of actions-part2.ts: a "use server" file may only
// export async functions.

import type { z } from "zod";
import type { ActionResult } from "./actions";


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

export function dbError<T>(e: unknown): ActionResult<T> {
  if (e instanceof Error && (
    e.constructor.name === "PrismaClientInitializationError" ||
    e.message.includes("Can't reach database server")
  )) {
    return { ok: false, error: "Database is unavailable. Please ensure the database server is running and try again." };
  }
  // Surface the real Prisma / runtime error instead of letting Next.js
  // swallow it into a generic "Something went wrong" toast. Owner needs
  // the specific message to know what to fix (unique constraint, missing
  // FK, RLS, etc). Only the first line — full stack goes to server log.
  console.error("leads.dbError:", e);
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: `Save failed: ${msg.split("\n")[0]}` };
}

export function normaliseMobile(m: string): string {
  const clean = m.trim();
  return clean.startsWith("+91") ? clean : `+91${clean}`;
}

export function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function parseRupeesInput(v: string | undefined | null): bigint | null {
  if (!v || v.trim() === "") return null;
  const clean = v.trim().replace(/[,₹\s]/g, "");
  const num = parseInt(clean, 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return BigInt(num) * 100n;
}
