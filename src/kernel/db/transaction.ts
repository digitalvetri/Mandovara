// withTransaction — the ONE place transactions start.
// Sessions 5 and 6 use this from the money and numbering kernels.
//
// Notes:
//   - Uses Prisma's interactive-transaction API. Everything inside `fn`
//     runs against the SAME connection, so SELECT ... FOR UPDATE + writes
//     participate in the same atomic unit. This is what makes the
//     numbering allocator and stock ledger safe under concurrency.
//   - Timeout raised to 15 s for the seed / import paths; module code
//     should stay well under.

import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type TxClient = Prisma.TransactionClient;

export interface TxOptions {
  timeoutMs?: number;
  maxWaitMs?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export function withTransaction<R>(
  fn: (tx: TxClient) => Promise<R>,
  opts: TxOptions = {},
): Promise<R> {
  return prisma.$transaction(fn, {
    timeout: opts.timeoutMs ?? 15_000,
    maxWait: opts.maxWaitMs ?? 5_000,
    isolationLevel: opts.isolationLevel,
  });
}
