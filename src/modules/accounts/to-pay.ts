// Lists money going out that hasn't cleared yet — the "To Pay" tab.
// Two sources: unpaid Purchase Orders (vendor money) and approved-
// unpaid Expenses (staff / office bills). Schema has no VendorBill
// model, so PO = vendor-owed.
//
// Permission-gated on expense.view: someone without it sees zeros.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ToPayRow {
  id:          string;
  kind:        "PO" | "EXPENSE";
  number:      string | null;   // MDV/PO-…; null for expenses (no number field on schema)
  label:       string;          // vendor name or expense description
  head:        string;          // "Rent", "Utilities", vendor category etc.
  amount:      bigint;
  dueDate:     Date;
  daysUntilDue: number;         // negative when overdue
}

export interface ToPayBundle {
  rows:            ToPayRow[];
  vendorTotal:     bigint;
  expenseTotal:    bigint;
  overdueTotal:    bigint;
  dueThisWeekTotal: bigint;
}

/** Everything the "To Pay" tab renders. Loads unpaid POs + approved
 *  unpaid expenses in one round-trip via Promise.all. */
export async function loadToPay(ctx: RequestContext): Promise<ToPayBundle> {
  requirePermission(ctx, "expense.view");
  const db  = scoped(ctx);
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  const [pos, expenses] = await Promise.all([
    db.purchaseOrder.findMany({
      where:   { status: { in: ["SENT", "PARTIAL"] } },
      orderBy: { expectedAt: "asc" },
      select: {
        id: true, number: true, totalValue: true, expectedAt: true, vendorId: true, status: true,
      },
    }),
    db.expense.findMany({
      where:   { approvalState: "APPROVED", paidAt: null },
      orderBy: { incurredAt: "asc" },
      select: {
        id: true, amount: true, incurredAt: true, head: true, subHead: true, description: true,
      },
    }),
  ]);

  // Resolve vendor names for the PO rows
  const vendorIds = [...new Set(pos.map((p) => p.vendorId))];
  const vendors = vendorIds.length > 0
    ? await db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
    : [];
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  const rows: ToPayRow[] = [];
  let vendorTotal  = 0n;
  let expenseTotal = 0n;
  let overdueTotal = 0n;
  let dueThisWeekTotal = 0n;

  for (const po of pos) {
    const dueDate     = po.expectedAt ?? now;
    const daysUntilDue = daysBetween(now, dueDate);
    vendorTotal += po.totalValue;
    if (daysUntilDue < 0)        overdueTotal    += po.totalValue;
    else if (dueDate < weekEnd)  dueThisWeekTotal += po.totalValue;
    rows.push({
      id:      `po:${po.id}`,
      kind:    "PO",
      number:  po.number,
      label:   vendorName.get(po.vendorId) ?? "Unknown vendor",
      head:    po.status === "PARTIAL" ? "Vendor · partial" : "Vendor",
      amount:  po.totalValue,
      dueDate, daysUntilDue,
    });
  }

  for (const e of expenses) {
    // Expenses have no dueDate field — use incurredAt as the informal
    // due-by proxy (matches what buildToPaySum does in queries.ts).
    const dueDate      = e.incurredAt;
    const daysUntilDue = daysBetween(now, dueDate);
    expenseTotal += e.amount;
    if (daysUntilDue < 0)        overdueTotal    += e.amount;
    else if (dueDate < weekEnd)  dueThisWeekTotal += e.amount;
    rows.push({
      id:      `exp:${e.id}`,
      kind:    "EXPENSE",
      number:  null,
      label:   e.description,
      head:    e.subHead ? `${e.head} · ${e.subHead}` : e.head,
      amount:  e.amount,
      dueDate, daysUntilDue,
    });
  }

  // Overdue first, then soonest-due, then largest.
  rows.sort((a, b) => {
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0;
  });

  return { rows, vendorTotal, expenseTotal, overdueTotal, dueThisWeekTotal };
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to);   b.setHours(0, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
