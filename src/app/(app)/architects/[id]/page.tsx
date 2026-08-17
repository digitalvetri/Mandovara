// /architects/[id] — detail: firm/contact, commission history table
// with per-row "Mark paid" button, linked clients.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime/index";
import { devContext } from "@/lib/dev-context";
import { getArchitect } from "@/modules/architects/queries";
import { MarkPaidButton } from "../_components/MarkPaidButton";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function ArchitectDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await devContext();
  const a = await getArchitect(ctx, id);
  if (!a) notFound();

  return (
    <>
      <Topbar
        title={a.firmName}
        eyebrow={`${a.code} · ${a.contactName} · ${a.mobile}${a.email ? ` · ${a.email}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 pb-10">
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Commission history
            </div>
            <div className="text-[11px] text-text-dim tabular">
              {a.commissionCount} commission{a.commissionCount === 1 ? "" : "s"}
            </div>
          </div>
          {a.commissions.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">
              No commissions yet. Orders from linked clients will stamp them automatically.
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
                  <Th>Project</Th>
                  <Th>Client</Th>
                  <Th align="right">Base</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {a.commissions.map((c) => (
                  <tr key={c.id} className={`border-b border-rule/60 last:border-0 align-middle ${c.cancelledAt ? "opacity-50" : ""}`}>
                    <Td>
                      <Link href={`/projects/${c.projectId}` as Route}
                            className="tabular text-accent hover:underline">
                        {c.projectNumber}
                      </Link>
                      <div className="text-[10.5px] text-text-faint tabular">{formatDate(c.createdAt)}</div>
                    </Td>
                    <Td>
                      <Link href={`/clients/${c.clientId}` as Route}
                            className="text-text hover:text-accent">
                        {c.clientName}
                      </Link>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(c.baseAmount)}</span></Td>
                    <Td align="right"><span className="tabular text-text">{c.pct}%</span></Td>
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(c.amount)}</span></Td>
                    <Td>
                      {c.cancelledAt
                        ? <span className="text-[10.5px] text-bad">CANCELLED</span>
                        : c.paidAt
                          ? (
                            <div>
                              <div className="text-[10.5px] text-good uppercase tracking-[0.06em]">paid</div>
                              <div className="text-[10.5px] text-text-faint tabular">
                                {formatDate(c.paidAt)} · {c.paymentRef}
                              </div>
                            </div>
                          )
                          : <span className="text-[10.5px] text-heat uppercase tracking-[0.06em]">outstanding</span>
                      }
                    </Td>
                    <Td align="right">
                      {c.paidAt == null && c.cancelledAt == null && (
                        <MarkPaidButton commissionId={c.id} />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-3">
              Totals
            </div>
            <dl className="space-y-2 text-[12.5px]">
              <Row k="Rate (current)"  v={`${a.commissionPct}%`} />
              <Row k="Clients"         v={String(a.clientCount)} />
              <Row k="Earned"          v={formatINR(a.earnedTotal)} />
              <Row k="Paid"            v={formatINR(a.paidTotal)} />
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Outstanding</dt>
                <dd className="font-display text-[20px] font-semibold text-text tabular-nums">
                  {formatINR(a.outstandingTotal)}
                </dd>
              </div>
            </dl>
          </div>

          {a.clients.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim mb-3">
                Linked clients ({a.clients.length})
              </div>
              <ul className="space-y-1.5 text-[11.5px]">
                {a.clients.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}` as Route}
                          className="text-text hover:text-accent">
                      {c.name}
                    </Link>
                    <span className="text-[10.5px] text-text-faint tabular ml-2">{c.mobile}</span>
                  </li>
                ))}
                {a.clients.length > 12 && (
                  <li className="text-[10.5px] text-text-faint pt-1">
                    +{a.clients.length - 12} more…
                  </li>
                )}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className="text-text text-right tabular">{v}</dd>
    </div>
  );
}
