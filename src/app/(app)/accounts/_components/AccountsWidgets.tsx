import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { OutstandingClientRow, RecentReceiptRow } from "@/modules/accounts/queries";

// ── Headline (one big number) ─────────────────────────────────────
export function Headline({
  owed, overdue, clientCount,
}: { owed: bigint; overdue: bigint; clientCount: number }) {
  const nothingDue = owed === 0n;

  return (
    <section className="mb-6 rounded-[14px] bg-surface border border-rule p-6 md:p-8">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-2">
        You are owed
      </div>
      <div className="font-display text-[36px] md:text-[44px] font-semibold tabular-nums leading-none text-text">
        {formatINR(owed)}
      </div>
      <div className="mt-3 text-[13px] text-text-dim">
        {nothingDue ? (
          "All invoices settled — you're all caught up."
        ) : (
          <>
            from {clientCount} client{clientCount === 1 ? "" : "s"}
            {overdue > 0n && (
              <>
                {" · "}
                <span className="text-bad tabular">{formatINR(overdue)}</span>{" "}
                is overdue
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ── Section card wrapper ──────────────────────────────────────────
export function SectionCard({
  title, note, children,
}: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <div className="px-5 py-3.5 border-b border-rule flex items-baseline justify-between gap-3">
        <div className="text-[13.5px] text-text font-medium">{title}</div>
        {note && <div className="text-[11px] text-text-dim tabular">{note}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Money owed to you (one row per client) ────────────────────────
export function MoneyOwedList({ rows }: { rows: OutstandingClientRow[] }) {
  return (
    <ul className="divide-y divide-rule/60">
      {rows.map((c) => {
        const overdue = c.oldestDays > 0;
        return (
          <li key={c.clientId} className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <Link
                href={`/clients/${c.clientId}` as Route}
                className="text-[13.5px] text-text hover:text-accent truncate min-w-0"
              >
                {c.clientName}
              </Link>
              <div className="tabular text-[14px] text-text font-medium whitespace-nowrap">
                {formatINR(c.outstanding)}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[11.5px] text-text-dim tabular">
                {c.invoiceCount} bill{c.invoiceCount === 1 ? "" : "s"}
                {overdue && (
                  <>
                    {" · "}
                    <span className="text-bad">oldest {c.oldestDays} day{c.oldestDays === 1 ? "" : "s"} late</span>
                  </>
                )}
                {!overdue && " · on time"}
              </div>
              <Link
                href={`/accounts/new?clientId=${c.clientId}` as Route}
                className="text-[11.5px] text-accent hover:underline whitespace-nowrap"
              >
                Record payment →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Recent payments (last 8) ──────────────────────────────────────
export function RecentPaymentsList({ rows }: { rows: RecentReceiptRow[] }) {
  return (
    <ul className="divide-y divide-rule/60">
      {rows.map((r) => (
        <li key={r.id} className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <div className="text-[13.5px] text-text truncate min-w-0">{r.clientName}</div>
            <div className="tabular text-[14px] text-text font-medium whitespace-nowrap">
              {formatINR(r.amount)}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-[11.5px] text-text-dim">
            <div className="tabular">
              {formatDate(r.date)}
              {" · "}
              <span className="uppercase tracking-[0.06em]">{r.mode}</span>
            </div>
            <Link
              href={`/accounts/${r.id}` as Route}
              className="text-accent hover:underline whitespace-nowrap"
            >
              View
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
