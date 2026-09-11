// One-time backfill: recompute PurchaseOrder.totalValue from its lines.
//
// Commit d0d588d ("the GST on a purchase order line now reaches the
// total", 2026-09-10) fixed calcPOTotals to make totalValue GST-inclusive,
// but wrote no migration for rows saved before the fix — they still carry
// the old, GST-exclusive figure. Left alone, "Committed on open POs",
// the vendor ledger, and any PO reaching RECEIVED read a column that means
// two different things depending on when the row was written.
//
// This recomputes totalValue for every non-cancelled PO from its POLines
// via the same calcPOTotals the app now uses, and — since a PO that
// already reached RECEIVED before the fix would have auto-created a
// vendor-payment Expense at the old, short figure — corrects that
// Expense's amount too when one exists (sourcePoId is unique per PO).
//
// Idempotent: a PO already GST-inclusive recomputes to the same figure
// and is skipped. Safe to run more than once.
//
// Run: npx tsx scripts/backfill-po-totals.ts

import { PrismaClient } from "@prisma/client";
import { calcPOTotals, scaleQty } from "../src/lib/calc/purchase-order";

const db = new PrismaClient({ log: [] });

async function main() {
  const pos = await db.purchaseOrder.findMany({
    where:  { status: { not: "CANCELLED" } },
    select: {
      id: true, number: true, totalValue: true,
      lines: { select: { rate: true, quantity: true, gstRate: true } },
    },
  });

  let changed = 0;
  let expensesFixed = 0;

  for (const po of pos) {
    const { total } = calcPOTotals(
      po.lines.map((l) => ({
        ratePaise:      l.rate,
        quantityScaled: scaleQty(Number(l.quantity)),
        gstRatePct:     Number(l.gstRate),
      })),
    );

    if (total === po.totalValue) continue;

    process.stdout.write(
      `${po.number}: ${po.totalValue.toString()} -> ${total.toString()}\n`,
    );

    await db.purchaseOrder.update({
      where: { id: po.id },
      data:  { totalValue: total },
    });
    changed++;

    const expense = await db.expense.findUnique({
      where:  { sourcePoId: po.id },
      select: { id: true, amount: true, paidAt: true },
    });
    if (expense && expense.amount !== total) {
      if (expense.paidAt) {
        process.stdout.write(
          `  ! vendor-payment expense for ${po.number} is already marked paid at the old amount ` +
          `(${expense.amount.toString()}) — not touching it. Review by hand.\n`,
        );
      } else {
        await db.expense.update({ where: { id: expense.id }, data: { amount: total } });
        expensesFixed++;
      }
    }
  }

  process.stdout.write(
    `\nDone. ${changed} of ${pos.length} purchase order(s) recomputed, ${expensesFixed} linked expense(s) corrected.\n`,
  );
}

main()
  .catch((e) => { process.stderr.write(String(e) + "\n"); process.exit(1); })
  .finally(() => db.$disconnect());
