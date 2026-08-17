import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { OutstandingClientRow, RecentReceiptRow, OutflowRow } from "@/modules/accounts/queries";

// ── Headline (one big number) ─────────────────────────────────────
export function Headline({
  owed, overdue, clientCount,
}: { owed: bigint; overdue: bigint; clientCount: number }) {
  const nothingDue = owed === 0n;

  return (
    <section className="mb-4 rounded-[14px] bg-surface border border-rule p-6 md:p-8">
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

// ── Money In / Out / Net strip ───────────────────────────────────
// Sits directly under Headline. Compares totals over the last 12 months
// so the shop owner can see if they're net-positive on cash-flow. Only
// renders when the viewer has permission to see any outflow at all
// (the `hidden` flag is set upstream in the query).
export function InOutStrip({
  moneyIn, moneyOut,
}: { moneyIn: bigint; moneyOut: bigint }) {
  const net       = moneyIn - moneyOut;
  const netTone   = net >= 0n ? "text-good" : "text-bad";
  const netSign   = net >= 0n ? "" : "−";
  const netAbs    = net < 0n ? -net : net;

  return (
    <section className="mb-6 grid grid-cols-3 divide-x divide-rule rounded-[14px] bg-surface border border-rule overflow-hidden">
      <Stat label="Money in (last 12 mo)"  value={formatINR(moneyIn)}          tone="text-text" />
      <Stat label="Money out (last 12 mo)" value={formatINR(moneyOut)}         tone="text-text" />
      <Stat label="Net"                    value={`${netSign}${formatINR(netAbs)}`} tone={netTone} />
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-5 py-4 md:px-6 md:py-5">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-1.5">{label}</div>
      <div className={`font-display text-[20px] md:text-[24px] font-semibold tabular-nums leading-none ${tone}`}>
        {value}
      </div>
    </div>
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

// ── Rich empty state for the Money-Owed card ─────────────────────
export function MoneyOwedEmpty() {
  return (
    <div className="px-5 py-6">
      <p className="text-[12.5px] text-text mb-3">
        As soon as you raise a tax invoice on a client, any unpaid balance shows
        up here — one row per client, biggest first.
      </p>
      <p className="text-[11.5px] text-text-dim mb-4">
        Right now every issued bill is settled — there's nothing outstanding.
      </p>
      <Link
        href={"/invoicing/new" as Route}
        className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
      >
        Create an invoice →
      </Link>
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
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <div className="text-[13.5px] text-text truncate min-w-0">{r.clientName}</div>
            <div className="tabular text-[14px] text-text font-medium whitespace-nowrap">
              {formatINR(r.amount)}
            </div>
          </div>
          <div className="text-[12px] text-text mb-1.5 truncate">{r.purpose}</div>
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

// ── Recent expenses & salary (unified outflow feed) ──────────────
const OUTFLOW_KIND_LABEL: Record<OutflowRow["kind"], string> = {
  SALARY:          "Salary",
  EXPENSE:         "Overhead",
  PROJECT_EXPENSE: "Project",
};
const OUTFLOW_KIND_TONE: Record<OutflowRow["kind"], string> = {
  SALARY:          "bg-info/10 text-info",
  EXPENSE:         "bg-warn/10 text-warn",
  PROJECT_EXPENSE: "bg-accent/10 text-accent",
};

export function RecentOutflowsList({ rows }: { rows: OutflowRow[] }) {
  return (
    <ul className="divide-y divide-rule/60">
      {rows.map((r) => (
        <li key={r.id} className="px-5 py-3.5 flex items-baseline justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium uppercase tracking-[0.06em] ${OUTFLOW_KIND_TONE[r.kind]}`}>
                {OUTFLOW_KIND_LABEL[r.kind]}
              </span>
              <div className="text-[13px] text-text truncate">{r.label}</div>
            </div>
            <div className="text-[11px] text-text-dim tabular">{formatDate(r.date)}</div>
          </div>
          <div className="tabular text-[13.5px] text-text font-medium whitespace-nowrap">
            −{formatINR(r.amount)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RecentOutflowsEmpty() {
  return (
    <div className="px-5 py-6">
      <p className="text-[12.5px] text-text mb-3">
        Salary payments (from finalised payroll runs) and business expenses
        will appear here — the most recent eight.
      </p>
      <ul className="space-y-1.5 mb-4 text-[11.5px] text-text-dim">
        <li>
          <span className="text-text font-medium">Salary</span> — from a paid
          monthly payroll run.
        </li>
        <li>
          <span className="text-text font-medium">Overhead</span> — rent,
          utilities, office costs.
        </li>
        <li>
          <span className="text-text font-medium">Project</span> — labour,
          site travel, materials tagged to a specific project.
        </li>
      </ul>
    </div>
  );
}

// ── Rich empty state for the Recent Payments card ────────────────
// Renders when there are no receipts yet. Explains what will appear
// so the empty screen isn't a mystery — mirrors the same categories
// the real rows use ("Advance", "Payment for INV-...", etc.).
export function RecentPaymentsEmpty() {
  return (
    <div className="px-5 py-6">
      <p className="text-[12.5px] text-text mb-3">
        Every payment you receive from a client will appear here — the most recent
        eight. Each row shows what the money is for.
      </p>
      <ul className="space-y-1.5 mb-4 text-[11.5px] text-text-dim">
        <li>
          <span className="text-text font-medium">Advance received</span> — money
          paid before an invoice is raised (kept on account).
        </li>
        <li>
          <span className="text-text font-medium">Payment for MDV/INV-…</span>{" "}
          — money applied to a specific tax invoice.
        </li>
        <li>
          <span className="text-text font-medium">…balance kept as advance</span>{" "}
          — extra paid over the invoice amount, held for the next one.
        </li>
      </ul>
      <Link
        href={"/accounts/new" as Route}
        className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
      >
        Record your first payment →
      </Link>
    </div>
  );
}
