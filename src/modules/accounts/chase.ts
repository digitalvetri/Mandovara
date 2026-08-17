// Chase-list scoring — the load-bearing element of the redesigned /accounts
// page (docs/ACCOUNTS-PAGE.md §6 + §16). Answers the question "who do I call
// today?" without the owner having to work it out.
//
// The pure `chaseScore` function is where every boundary test lives. The
// `loadChaseList` query is a thin wrapper that pulls the shape chaseScore
// needs and returns the top-N rows already sorted + filtered.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// ── Types ───────────────────────────────────────────────────────────

/** Input shape for the pure scorer — matches what the query returns per client. */
export interface ChaseInput {
  clientId:        string;
  clientName:      string;
  clientMobile:    string;
  outstanding:     bigint;         // sum of unpaid invoice balances
  oldestDueDate:   Date;           // due date of the client's oldest unpaid bill
  doNotChase:      boolean;
  lastContactedAt: Date | null;
  activePromiseDate: Date | null;  // future-dated promise → suppress
  disputed:        boolean;
}

/** Output row for the UI — everything the chase list needs, no more. */
export interface ChaseRow {
  clientId:              string;
  clientName:            string;
  clientMobile:          string;
  outstanding:           bigint;
  oldestLateDays:        number;
  lastContactedDaysAgo:  number | null;
  activePromiseDate:     Date | null;
  score:                 number;
}

/** Score internals — exported so the boundary tests can assert every knob. */
export const DAYS_LATE_TIERS: ReadonlyArray<{ min: number; max: number; weight: number }> = [
  { min: 0,   max: 15,       weight: 0.5 },
  { min: 16,  max: 30,       weight: 1.0 },
  { min: 31,  max: 60,       weight: 2.0 },
  { min: 61,  max: 90,       weight: 3.5 },
  { min: 91,  max: Infinity, weight: 5.0 },
];

export const CONTACT_PENALTIES = {
  today:          0,      // → HIDDEN
  within2Days:    0.3,
  within7Days:    0.7,
  older:          1.5,
  neverContacted: 1.5,
} as const;

// ── Pure scorer ─────────────────────────────────────────────────────

/** Returns a positive score, or null if the client should be hidden. */
export function chaseScore(input: ChaseInput, now: Date = new Date()): number | null {
  if (input.outstanding <= 0n)      return null;
  if (input.doNotChase)             return null;
  if (input.disputed)               return null;

  // Suppress while a promise is still in the future. Promises whose date has
  // passed without payment resurface the client (marked "missed" upstream).
  if (input.activePromiseDate && daysUntil(input.activePromiseDate, now) > 0) {
    return null;
  }

  const oldestLate = daysBetween(input.oldestDueDate, now);
  const daysLateWeight = pickWeight(oldestLate);

  const contactPenalty = pickContactPenalty(input.lastContactedAt, now);
  if (contactPenalty === CONTACT_PENALTIES.today) return null;

  // Score is amount × late-tier × contact-penalty. Amount stays a bigint at
  // rest; convert to a Number here (paise → JS number) — safe at any Indian
  // SME outstanding.
  const amountInRupees = Number(input.outstanding) / 100;
  return amountInRupees * daysLateWeight * contactPenalty;
}

/** Days between two dates, floored, positive when `later` is after `earlier`. */
export function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((toMidnight(later).getTime() - toMidnight(earlier).getTime()) / 86_400_000);
}
/** Positive if the date is in the future, 0 if today, negative if past. */
export function daysUntil(target: Date, now: Date): number {
  return daysBetween(now, target);
}

function toMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function pickWeight(daysLate: number): number {
  // Boundary contract: day 15 = 0.5; day 16 = 1.0; day 30 = 1.0; day 31 = 2.0;
  // day 60 = 2.0; day 61 = 3.5; day 90 = 3.5; day 91 = 5.0.
  for (const t of DAYS_LATE_TIERS) {
    if (daysLate >= t.min && daysLate <= t.max) return t.weight;
  }
  // daysLate < 0 (not yet due) falls into tier[0] (0–15). Shouldn't normally
  // happen since callers only pass rows where outstanding > 0.
  return DAYS_LATE_TIERS[0]!.weight;
}

function pickContactPenalty(lastContactedAt: Date | null, now: Date): number {
  if (lastContactedAt == null) return CONTACT_PENALTIES.neverContacted;
  const ago = daysBetween(lastContactedAt, now);
  // Boundary contract: contacted today = 0 (HIDDEN); day-old = 0.3;
  // 2-day = 0.3; 3–7 = 0.7; 7+ = 1.5.
  if (ago <= 0) return CONTACT_PENALTIES.today;
  if (ago <= 2) return CONTACT_PENALTIES.within2Days;
  if (ago <= 7) return CONTACT_PENALTIES.within7Days;
  return CONTACT_PENALTIES.older;
}

// ── Query ───────────────────────────────────────────────────────────

/** Load the top-N clients to chase today, already sorted + filtered. */
export async function loadChaseList(
  ctx:  RequestContext,
  opts: { take?: number } = {},
): Promise<ChaseRow[]> {
  requirePermission(ctx, "receipt.view");
  const db  = scoped(ctx);
  const now = new Date();
  const take = opts.take ?? 5;

  // Pull open invoices + their allocations. ReceiptAllocation has only
  // invoiceId (no direct invoice relation) so we join in memory after
  // fetching both — at typical SME scale (~1k open invoices) this stays
  // fast enough that a materialised view isn't warranted yet.
  const opens = await db.invoice.findMany({
    where:  { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
    select: { id: true, clientId: true, dueDate: true, total: true, advanceAdjusted: true },
  });
  if (opens.length === 0) return [];

  const openIds = opens.map((i) => i.id);
  const allocGroups = await db.receiptAllocation.groupBy({
    by:    ["invoiceId"],
    where: { invoiceId: { in: openIds } },
    _sum:  { amount: true },
  });
  const allocatedById = new Map<string, bigint>();
  for (const g of allocGroups) allocatedById.set(g.invoiceId, g._sum.amount ?? 0n);

  // Aggregate per client: outstanding sum + oldest due date.
  interface Agg { outstanding: bigint; oldestDue: Date }
  const perClient = new Map<string, Agg>();
  for (const inv of opens) {
    const allocated = allocatedById.get(inv.id) ?? 0n;
    const bal = inv.total - inv.advanceAdjusted - allocated;
    if (bal <= 0n) continue;
    const cur = perClient.get(inv.clientId);
    if (!cur) {
      perClient.set(inv.clientId, { outstanding: bal, oldestDue: inv.dueDate });
    } else {
      cur.outstanding += bal;
      if (inv.dueDate < cur.oldestDue) cur.oldestDue = inv.dueDate;
    }
  }
  if (perClient.size === 0) return [];

  const clientIds = [...perClient.keys()];
  const [clients, promises] = await Promise.all([
    db.client.findMany({
      where:  { id: { in: clientIds } },
      select: { id: true, name: true, mobile: true, doNotChase: true, lastContactedAt: true },
    }),
    db.promiseToPay.findMany({
      where: {
        clientId: { in: clientIds },
        status:   "ACTIVE",
      },
      select:  { clientId: true, promisedDate: true },
      orderBy: { promisedDate: "desc" },
    }),
  ]);

  const promiseByClient = new Map<string, Date>();
  for (const p of promises) {
    // Keep the latest active promise per client.
    if (!promiseByClient.has(p.clientId)) promiseByClient.set(p.clientId, p.promisedDate);
  }

  const rows: ChaseRow[] = [];
  for (const c of clients) {
    const agg = perClient.get(c.id)!;
    const promise = promiseByClient.get(c.id) ?? null;
    const score = chaseScore({
      clientId:          c.id,
      clientName:        c.name,
      clientMobile:      c.mobile,
      outstanding:       agg.outstanding,
      oldestDueDate:     agg.oldestDue,
      doNotChase:        c.doNotChase,
      lastContactedAt:   c.lastContactedAt,
      activePromiseDate: promise,
      disputed:          false,  // no disputed flag on Invoice today — always false for now
    }, now);
    if (score == null) continue;
    rows.push({
      clientId:             c.id,
      clientName:           c.name,
      clientMobile:         c.mobile,
      outstanding:          agg.outstanding,
      oldestLateDays:       Math.max(0, daysBetween(agg.oldestDue, now)),
      lastContactedDaysAgo: c.lastContactedAt ? daysBetween(c.lastContactedAt, now) : null,
      activePromiseDate:    promise,
      score,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, take);
}
