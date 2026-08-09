// Gap-free document numbering against the Mandovara schema (CLAUDE.md §4).
//
// Series codes: ENQ PRJ MEA QT SO PO GRN MJ INS INV RCT CN SMP
// Format: {prefix}/{series}-{yymm}-{counter}  e.g. MDV/QT-2608-0142
//   prefix = Branch.invoicePrefix  (e.g. "MDV")
//   series = two-to-three letter code (e.g. "QT")
//   yymm   = last-two-digits-of-year + zero-padded month  (e.g. "2608")
//   counter= 4-digit zero-padded, resets each yymm
//
// Allocation runs inside the caller's transaction. INSERT ... ON CONFLICT
// DO UPDATE takes an exclusive row-level lock on the NumberSequence row so
// concurrent transactions serialise on the counter monotonically.

import { Prisma } from "@prisma/client";
import type { TxClient } from "@/kernel/db/transaction";

export { Prisma };

export interface AllocateNumberParams {
  orgId:    string;
  series:   string;   // "QT" | "INV" | "PO" | "GRN" | "PRJ" | etc.
  yymm:     string;   // "2608" for August 2026
  prefix:   string;   // Branch.invoicePrefix, e.g. "MDV"
  padding?: number;   // default 4
}

export function yymmFromDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return yy + mm;
}

export async function allocateNumber(
  tx: TxClient,
  params: AllocateNumberParams,
): Promise<string> {
  const { orgId, series, yymm, prefix, padding = 4 } = params;

  const rows = await tx.$queryRaw<{ counter: number }[]>`
    INSERT INTO "NumberSequence" (id, "organizationId", series, yymm, counter)
    VALUES (${cuid()}, ${orgId}, ${series}, ${yymm}, 1)
    ON CONFLICT ("organizationId", series, yymm)
    DO UPDATE SET counter = "NumberSequence".counter + 1
    RETURNING counter
  `;

  const row = rows[0];
  if (!row) throw new Error("allocateNumber: upsert returned no row");

  const seq = row.counter.toString().padStart(padding, "0");
  return `${prefix}/${series}-${yymm}-${seq}`;
}

/** Peek at the next number without incrementing. For UI previews only. */
export async function peekNextNumber(
  tx: TxClient,
  params: Omit<AllocateNumberParams, "prefix"> & { prefix?: string },
): Promise<string> {
  const row = await tx.numberSequence.findUnique({
    where: {
      organizationId_series_yymm: {
        organizationId: params.orgId,
        series: params.series,
        yymm: params.yymm,
      },
    },
    select: { counter: true },
  });
  const next = (row?.counter ?? 0) + 1;
  const padding = params.padding ?? 4;
  const prefix = params.prefix ?? params.series;
  return `${prefix}/${params.series}-${params.yymm}-${next.toString().padStart(padding, "0")}`;
}

function cuid(): string {
  const rand = () => Math.random().toString(36).slice(2, 12);
  return "c" + Date.now().toString(36) + rand() + rand();
}
