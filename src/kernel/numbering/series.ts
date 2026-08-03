// Gap-free document numbering. Twelve Rules #6:
//
//   "Document numbers come from a database sequence, allocated inside the
//    transaction that writes the document. Gap-free, per branch, per
//    financial year, per document type."
//
// Design (docs/BUILD-SPEC.md §8.2 item 4):
//   - Every doc-number allocation runs INSIDE the caller's transaction.
//   - We use a NumberingSeries row per (orgId, branchId, docType, financialYear)
//     with a `currentValue` BIGINT counter.
//   - Postgres UPDATE on the row takes an exclusive row-level lock; concurrent
//     transactions serialise on it, so counters increment monotonically.
//   - If a NumberingSeries row does not yet exist, we create it atomically
//     with ON CONFLICT DO UPDATE. First allocation returns 1.
//   - Format is `${prefix}/${fy}/${paddedNumber}`. Padding configurable on the
//     row (default 5 → "00001").
//
// Gap-freeness holds when transactions COMMIT. A rollback undoes the counter
// bump (the whole point of "inside the transaction"). Financial regulators
// generally accept this — but if a specific compliance surface (e.g.
// e-invoicing) needs strict gap-freeness across rollbacks, we'd wrap the
// allocation in its own committed transaction and reserve the number ahead of
// time. Session 16 revisits this for the IRN flow.

import { Prisma } from "@prisma/client";
import type { TxClient } from "@/kernel/db/transaction";

export interface AllocateNumberParams {
  orgId: string;
  branchId: string;
  docType: string;         // "INVOICE" | "QUOTATION" | "GRN" | "PO" | "CHALLAN" | ...
  financialYear: string;   // "26-27"
  prefix: string;          // "MDV/CBE/INV"
  padding?: number;        // default 5
}

/**
 * Allocate the next document number for the given series. Runs entirely
 * inside `tx`; the caller is responsible for the surrounding transaction.
 */
export async function allocateNumber(
  tx: TxClient,
  params: AllocateNumberParams,
): Promise<string> {
  const { orgId, branchId, docType, financialYear, prefix, padding = 5 } = params;

  // Atomic upsert-and-increment. Uses the @@unique constraint on
  // (orgId, branchId, docType, financialYear).
  //
  // We use $queryRawUnsafe on the parametrised SQL because Prisma's
  // upsert doesn't expose "increment" on the update branch without a
  // read-then-write, and we specifically want the DB to do the increment
  // atomically under row-level lock.
  const rows = await tx.$queryRaw<{ currentValue: bigint; padding: number }[]>`
    INSERT INTO "NumberingSeries" ("id", "orgId", "branchId", "docType",
                                    "financialYear", "prefix", "padding", "currentValue")
    VALUES (${cuid()}, ${orgId}, ${branchId}, ${docType},
            ${financialYear}, ${prefix}, ${padding}, 1)
    ON CONFLICT ("orgId", "branchId", "docType", "financialYear")
    DO UPDATE SET "currentValue" = "NumberingSeries"."currentValue" + 1
    RETURNING "currentValue", "padding"
  `;

  const row = rows[0];
  if (!row) throw new Error("allocateNumber: upsert returned no row");

  const seqNumber = row.currentValue.toString().padStart(row.padding, "0");
  return `${prefix}/${financialYear}/${seqNumber}`;
}

/** Peek at the next number that WOULD be allocated, without incrementing.
 *  For UI previews. Do NOT rely on this for a real allocation. */
export async function peekNextNumber(
  tx: TxClient,
  params: Omit<AllocateNumberParams, "prefix"> & { prefix?: string },
): Promise<string> {
  const row = await tx.numberingSeries.findUnique({
    where: {
      orgId_branchId_docType_financialYear: {
        orgId: params.orgId, branchId: params.branchId,
        docType: params.docType, financialYear: params.financialYear,
      },
    },
    select: { currentValue: true, padding: true, prefix: true },
  });
  const next = (row?.currentValue ?? 0n) + 1n;
  const padding = row?.padding ?? params.padding ?? 5;
  const prefix = params.prefix ?? row?.prefix ?? params.docType;
  return `${prefix}/${params.financialYear}/${next.toString().padStart(padding, "0")}`;
}

// ── Internals ────────────────────────────────────────────────

// Minimal cuid — Prisma's @default(cuid()) only runs on regular create, not
// raw SQL. This mirrors the shape (25-char c-prefixed base36) enough that
// downstream code doesn't distinguish.
function cuid(): string {
  const rand = () => Math.random().toString(36).slice(2, 12);
  return "c" + Date.now().toString(36) + rand() + rand();
}

// Re-export Prisma so callers that need Prisma.sql tagging can grab it via us.
export { Prisma };
