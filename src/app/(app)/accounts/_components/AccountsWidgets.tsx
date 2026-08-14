import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { AgingBucket, OutstandingInvoiceRow, RecentReceiptRow } from "@/modules/accounts/queries";

// ── KPI card ──────────────────────────────────────────────────────
export function KpiCard({
  label, value, tone, hint,
}: { label: string; value: string; tone: "neutral" | "good" | "warn" | "bad" | "accent"; hint?: string }) {
  const border =
    tone === "good"   ? "border-l-good"   :
    tone === "warn"   ? "border-l-warn"   :
    tone === "bad"    ? "border-l-bad"    :
    tone === "accent" ? "border-l-accent" :
                        "border-l-rule";
  const valueTone =
    tone === "good"   ? "text-good"   :
    tone === "warn"   ? "text-warn"   :
    tone === "bad"    ? "text-bad"    :
    tone === "accent" ? "text-accent" :
                        "text-text";
  return (
    <div className={`rounded-[14px] bg-surface border border-rule border-l-[3px] ${border} p-4 sm:p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      <div className={`mt-2 font-display text-[20px] sm:text-[26px] font-semibold tabular-nums leading-none ${valueTone}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[10.5px] text-text-faint">{hint}</div>}
    </div>
  );
}

// ── Aging bucket cell (link) ──────────────────────────────────────
export function AgingCell({
  bucket, activeBucket,
}: { bucket: AgingBucket; activeBucket: AgingBucket["key"] | null }) {
  const isActive = activeBucket === bucket.key;
  const empty = bucket.amount === 0n;
  const tone =
    bucket.key === "current" ? "text-text-dim" :
    bucket.key === "d1_30"   ? "text-warn"     :
    bucket.key === "d31_60"  ? "text-warn"     :
                               "text-bad";
  const href = isActive ? "/accounts" : `/accounts?bucket=${bucket.key}`;
  return (
    <Link
      href={href as Route}
      className={`px-3 py-3 min-w-0 block transition-colors hover:bg-surface-hover ${
        isActive ? "bg-gold/6 border-b-2 border-b-gold" : ""
      }`}
    >
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim truncate">{bucket.label}</div>
      <div className={`mt-1.5 tabular text-[15px] font-medium leading-none ${empty ? "text-text-faint" : tone}`}>
        {formatINR(bucket.amount)}
      </div>
      <div className="mt-1 text-[10.5px] text-text-dim tabular">
        {bucket.count} invoice{bucket.count === 1 ? "" : "s"}
      </div>
    </Link>
  );
}

// ── Section header ────────────────────────────────────────────────
export function SectionHeader({
  title, note, action,
}: { title: React.ReactNode; note?: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between gap-3 flex-wrap">
      <div className="text-[13px] text-text">{title}</div>
      <div className="flex items-baseline gap-1">
        {note && <div className="text-[11px] text-text-dim tabular">{note}</div>}
        {action}
      </div>
    </div>
  );
}

// ── Outstanding invoices table ────────────────────────────────────
export function OutstandingTable({ rows }: { rows: OutstandingInvoiceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Th>Invoice</Th><Th>Client</Th><Th>Project</Th><Th>Due date</Th>
            <Th align="right">Invoice amt</Th><Th align="right">Paid</Th>
            <Th align="right">Balance</Th><Th align="right">Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/invoicing/${i.id}` as Route} className="text-text hover:text-accent tabular">
                  {i.number}
                </Link>
              </Td>
              <Td>
                <div className="text-text">{i.clientName}</div>
                <div className="text-[10.5px] text-text-dim tabular">{i.clientMobile}</div>
              </Td>
              <Td>
                {i.projectName
                  ? <span className="text-text-dim text-[11.5px]">{i.projectName}</span>
                  : <span className="text-text-faint">—</span>}
              </Td>
              <Td>
                <span className={`tabular ${i.daysOverdue > 0 ? "text-warn" : "text-text-dim"}`}>
                  {formatDate(i.dueDate)}
                </span>
              </Td>
              <Td align="right"><span className="tabular text-text-dim">{formatINR(i.total)}</span></Td>
              <Td align="right">
                <span className="tabular text-text-dim">{i.paid > 0n ? formatINR(i.paid) : "—"}</span>
              </Td>
              <Td align="right"><span className="tabular text-text font-medium">{formatINR(i.outstanding)}</span></Td>
              <Td align="right">
                {i.daysOverdue > 0 ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-medium tabular ${
                    i.daysOverdue > 60 ? "bg-bad/10 text-bad" :
                    i.daysOverdue > 30 ? "bg-bad/8 text-bad" :
                                         "bg-warn/10 text-warn"
                  }`}>
                    +{i.daysOverdue}d overdue
                  </span>
                ) : (
                  <span className="text-[11px] text-text-faint tabular">on time</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recent receipts table ─────────────────────────────────────────
export function RecentReceiptsTable({ rows }: { rows: RecentReceiptRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Th>Receipt no.</Th><Th>Date</Th><Th>Client</Th><Th>Mode</Th>
            <Th align="right">Amount</Th><Th align="right">Applied</Th><Th align="right">On account</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/accounts/${r.id}` as Route} className="text-text hover:text-accent tabular">
                  {r.number}
                </Link>
              </Td>
              <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
              <Td>{r.clientName}</Td>
              <Td className="text-text-dim uppercase text-[10.5px] tracking-[0.06em]">{r.mode}</Td>
              <Td align="right"><span className="tabular text-text font-medium">{formatINR(r.amount)}</span></Td>
              <Td align="right">
                <span className="tabular text-text-dim">
                  {r.amount - r.unallocated > 0n ? formatINR(r.amount - r.unallocated) : "—"}
                </span>
              </Td>
              <Td align="right">
                <span className={`tabular ${r.unallocated > 0n ? "text-accent" : "text-text-faint"}`}>
                  {r.unallocated > 0n ? formatINR(r.unallocated) : "—"}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── shared table helpers ──────────────────────────────────────────
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align = "left", className = "" }: {
  children: React.ReactNode; align?: "left" | "right"; className?: string;
}) {
  return <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
