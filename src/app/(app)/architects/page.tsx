// /architects — referral partners list (§5.2, Phase 6b).
//
// Row per active architect first, then inactive. Shows client count,
// commission count, earned/paid/outstanding totals. Click a row to
// open detail.

import Link from "next/link";
import type { Route } from "next";
import { Topbar, PrimaryButton } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { listArchitects } from "@/modules/architects/queries";

export const dynamic = "force-dynamic";

export default async function ArchitectsPage() {
  const ctx = await devContext();
  const rows = await listArchitects(ctx);

  const activeCount = rows.filter((r) => r.isActive).length;
  const outstanding = rows.reduce((s, r) => s + r.outstandingTotal, 0n);

  return (
    <>
      <Topbar
        title="Architects"
        eyebrow={`${rows.length} on record · ${activeCount} active · ${formatINR(outstanding)} commission outstanding`}
        actions={<PrimaryButton href="/architects/new">New architect</PrimaryButton>}
      />

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <div className="text-[14px] text-text mb-1">No architects yet.</div>
            <div className="text-[11.5px] text-text-dim">
              Add a referral partner to auto-stamp commissions on their clients&apos; orders.
            </div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Code</Th>
                <Th>Firm</Th>
                <Th>Contact</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Clients</Th>
                <Th align="right">Earned</Th>
                <Th align="right">Outstanding</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule/60 last:border-0 hover:bg-bg/40">
                  <Td>
                    <Link href={`/architects/${r.id}` as Route}
                          className="tabular text-accent hover:underline">
                      {r.code}
                    </Link>
                  </Td>
                  <Td>{r.firmName}</Td>
                  <Td>
                    <div className="text-text">{r.contactName}</div>
                    <div className="text-[10.5px] text-text-dim tabular">{r.mobile}</div>
                  </Td>
                  <Td align="right"><span className="tabular text-text">{r.commissionPct}%</span></Td>
                  <Td align="right"><span className="tabular text-text-dim">{r.clientCount}</span></Td>
                  <Td align="right"><span className="tabular text-text">{formatINR(r.earnedTotal)}</span></Td>
                  <Td align="right">
                    <span className={`tabular ${r.outstandingTotal > 0n ? "text-warn" : "text-text-dim"}`}>
                      {formatINR(r.outstandingTotal)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className={`text-[10.5px] uppercase tracking-[0.06em] ${r.isActive ? "text-good" : "text-text-faint"}`}>
                      {r.isActive ? "active" : "inactive"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[36px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-3 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
