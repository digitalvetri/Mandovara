import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { listReceipts } from "@/modules/receipts/queries";
import { loadAccountsOverview } from "@/modules/accounts/queries";
import { ReceiptsTable } from "./_components/ReceiptsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  page?: string;
  sort?: string;
}

export default async function AccountsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const q = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "amount" | undefined) ?? "recent";

  const [overview, receipts] = await Promise.all([
    loadAccountsOverview(ctx),
    listReceipts(ctx, { ...(q != null && { search: q }), page, sort }),
  ]);

  const hasAnyMoney =
    overview.invoiced > 0n || overview.received > 0n || overview.outstanding > 0n;

  return (
    <>
      <Topbar
        title="Accounts & Payments"
        eyebrow={
          hasAnyMoney
            ? `${overview.invoiceCount} invoice${overview.invoiceCount === 1 ? "" : "s"} · ${overview.paidCount} settled · ${overview.overdueCount} overdue`
            : "Record your first invoice and receipt to see the money view"
        }
        actions={
          <Link href={"/accounts/new" as Route}>
            <PrimaryButton>Record Receipt</PrimaryButton>
          </Link>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Invoiced"    value={formatINR(overview.invoiced)}    tone="text" />
        <BandCard label="Received"    value={formatINR(overview.received)}    tone="good" />
        <BandCard label="Outstanding" value={formatINR(overview.outstanding)} tone="warn" />
        <BandCard label="Overdue"     value={formatINR(overview.overdue)}     tone="bad" />
      </section>

      {overview.onAccount > 0n && (
        <div className="mb-4 rounded-[14px] bg-accent/8 border border-accent/30 px-4 py-3 flex items-baseline justify-between">
          <div className="text-[12.5px] text-text">
            <span className="text-text-dim">Unallocated advance on account</span>{" "}
            <span className="tabular text-accent font-medium ml-2">{formatINR(overview.onAccount)}</span>
          </div>
          <div className="text-[11px] text-text-dim">Apply to an invoice from Record Receipt</div>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 rounded-[14px] bg-surface border border-rule overflow-hidden">
          <SectionHeader
            title="Aging of receivables"
            note={overview.outstanding > 0n
              ? `${formatINR(overview.outstanding)} across ${overview.outstandingInvoices.length} invoice${overview.outstandingInvoices.length === 1 ? "" : "s"} (top 25 shown)`
              : "No outstanding balance"}
          />
          <div className="grid grid-cols-5 divide-x divide-rule border-b border-rule">
            {overview.aging.map((b) => (
              <AgingCell key={b.key} bucket={b} />
            ))}
          </div>
          {overview.outstandingInvoices.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">
              No outstanding invoices. Every issued bill is settled.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    <Th>Invoice</Th>
                    <Th>Client</Th>
                    <Th>Due</Th>
                    <Th align="right">Outstanding</Th>
                    <Th align="right">Age</Th>
                  </tr>
                </thead>
                <tbody>
                  {overview.outstandingInvoices.map((i) => (
                    <tr key={i.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                      <Td>
                        <Link href={`/invoices/${i.id}` as Route} className="text-text hover:text-accent tabular">
                          {i.number}
                        </Link>
                      </Td>
                      <Td>
                        <div className="text-text">{i.clientName}</div>
                        <div className="text-[10.5px] text-text-dim tabular">{i.clientMobile}</div>
                      </Td>
                      <Td className="text-text-dim tabular">{formatDate(i.dueDate)}</Td>
                      <Td align="right">
                        <div className="tabular text-text font-medium">{formatINR(i.outstanding)}</div>
                        {i.paid > 0n && (
                          <div className="text-[10.5px] text-text-faint tabular">
                            paid {formatINR(i.paid)} of {formatINR(i.total)}
                          </div>
                        )}
                      </Td>
                      <Td align="right">
                        {i.daysOverdue > 0 ? (
                          <span className={`text-[11px] font-medium tabular ${i.daysOverdue > 30 ? "text-bad" : "text-warn"}`}>
                            +{i.daysOverdue}d
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
          )}
        </div>

        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule overflow-hidden h-fit">
          <SectionHeader
            title="Who owes most"
            note={overview.topClients.length ? `${overview.topClients.length} client${overview.topClients.length === 1 ? "" : "s"}` : undefined}
          />
          {overview.topClients.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">Everyone is square.</div>
          ) : (
            <ul className="divide-y divide-rule/60">
              {overview.topClients.map((c) => (
                <li key={c.clientId} className="px-4 py-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/clients/${c.clientId}` as Route} className="text-[12.5px] text-text hover:text-accent truncate block">
                      {c.clientName}
                    </Link>
                    <div className="text-[10.5px] text-text-dim tabular">
                      {c.invoiceCount} invoice{c.invoiceCount === 1 ? "" : "s"}
                      {c.oldestDays > 0 && <span className="ml-2">· oldest +{c.oldestDays}d</span>}
                    </div>
                  </div>
                  <div className="tabular text-text font-medium whitespace-nowrap">{formatINR(c.outstanding)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-[14px] bg-surface border border-rule overflow-hidden">
        <SectionHeader
          title="Recent receipts"
          note={overview.recentReceipts.length ? "Last 8 payments received" : undefined}
        />
        {overview.recentReceipts.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-text-faint">
            No receipts yet.{" "}
            <Link href={"/accounts/new" as Route} className="text-accent hover:underline">
              Record the first one
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th>Number</Th>
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Mode</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">On account</Th>
                </tr>
              </thead>
              <tbody>
                {overview.recentReceipts.map((r) => (
                  <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                    <Td>
                      <Link href={`/accounts/${r.id}` as Route} className="text-text hover:text-accent tabular">{r.number}</Link>
                    </Td>
                    <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
                    <Td>{r.clientName}</Td>
                    <Td className="text-text-dim uppercase text-[10.5px] tracking-[0.06em]">{r.mode}</Td>
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(r.amount)}</span></Td>
                    <Td align="right">
                      <span className={`tabular ${r.unallocated > 0n ? "text-warn" : "text-text-faint"}`}>
                        {r.unallocated > 0n ? formatINR(r.unallocated) : "—"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        All receipts {q ? `matching “${q}”` : ""}
      </div>
      <ReceiptsTable rows={receipts.rows} />
      <Pager page={page} pageSize={receipts.pageSize} total={receipts.total} />
    </>
  );
}

function BandCard({
  label, value, tone,
}: { label: string; value: string; tone: "text" | "good" | "warn" | "bad" }) {
  const border =
    tone === "good" ? "border-l-good" :
    tone === "warn" ? "border-l-warn" :
    tone === "bad"  ? "border-l-bad"  :
                      "border-l-rule";
  const valueTone =
    tone === "good" ? "text-good" :
    tone === "warn" ? "text-warn" :
    tone === "bad"  ? "text-bad"  :
                      "text-text";
  return (
    <div className={`rounded-[14px] bg-surface border border-rule border-l-[3px] ${border} p-4 sm:p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      <div className={`mt-2 sm:mt-3 font-display text-[20px] sm:text-[26px] font-semibold tabular-nums leading-none ${valueTone}`}>
        {value}
      </div>
    </div>
  );
}

function AgingCell({ bucket }: { bucket: import("@/modules/accounts/queries").AgingBucket }) {
  const empty = bucket.amount === 0n;
  const tone =
    bucket.key === "current" ? "text-text-dim" :
    bucket.key === "d1_30"   ? "text-warn"     :
    bucket.key === "d31_60"  ? "text-warn"     :
                               "text-bad";
  return (
    <div className="px-3 py-3 min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim truncate">{bucket.label}</div>
      <div className={`mt-1.5 tabular text-[15px] font-medium leading-none ${empty ? "text-text-faint" : tone}`}>
        {formatINR(bucket.amount)}
      </div>
      <div className="mt-1 text-[10.5px] text-text-dim tabular">
        {bucket.count} invoice{bucket.count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between gap-3 flex-wrap">
      <div className="text-[13px] text-text">{title}</div>
      {note && <div className="text-[11px] text-text-dim tabular">{note}</div>}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
