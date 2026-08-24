import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { getPO } from "@/modules/purchase/queries";
import { POStatusPill } from "../_components/StatusPill";
import { SendOnWhatsAppButton } from "./_components/SendOnWhatsAppButton";
import { POStatusActions } from "./_components/POStatusActions";
import { MarkPaidButton } from "@/app/(app)/accounts/_components/MarkPaidButton";

export const dynamic = "force-dynamic";

export default async function PODetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const [po, vendorExpense] = await Promise.all([
    getPO(ctx, id),
    scoped(ctx).expense.findUnique({
      where: { sourcePoId: id },
      select: { id: true, amount: true, approvalState: true, paidAt: true },
    }),
  ]);
  if (!po) notFound();

  // ── Financial summary ────────────────────────────────────────────────────
  const orderedValue  = po.totalValue;
  const receivedValue = po.lines.reduce((s, l) => {
    return s + BigInt(Math.round(Number(l.rate) * parseFloat(l.receivedQty)));
  }, 0n);
  const pendingValue = orderedValue - receivedValue;

  // ── Urgency ──────────────────────────────────────────────────────────────
  let urgency: { label: string; level: "ok" | "warn" | "bad" } | null = null;
  if (po.expectedAt && po.status !== "RECEIVED" && po.status !== "CANCELLED") {
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(po.expectedAt);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expDate.getTime() - today.getTime()) / 86_400_000);
    if (diffDays < 0) {
      urgency = { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`, level: "bad" };
    } else if (diffDays <= 3) {
      urgency = { label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`, level: "warn" };
    } else {
      urgency = { label: `Due in ${diffDays} days`, level: "ok" };
    }
  }

  const urgencyClass = {
    ok:   "bg-good/10 text-good border-good/20",
    warn: "bg-warn/10 text-warn border-warn/20",
    bad:  "bg-fault/10 text-fault border-fault/30",
  };

  return (
    <>
      <Topbar
        title={po.number}
        eyebrow={`${po.vendorName} · ${po.vendorMobile} · raised ${formatDate(po.date)}${po.expectedAt ? ` · expected by ${formatDate(po.expectedAt)}` : ""}`}
        actions={
          <div className="flex items-center gap-4">
            <POStatusPill status={po.status} />
            <div className="font-display text-[20px] font-semibold text-text tabular-nums">
              {formatINR(po.totalValue)}
            </div>
            <a
              href={`/api/purchase/${po.id}/pdf`}
              className="h-[32px] px-4 rounded-[8px] bg-surface border border-rule text-text-dim hover:text-text hover:border-rule/80 text-[12px] font-medium transition-colors inline-flex items-center"
            >
              Download PDF
            </a>
            <SendOnWhatsAppButton po={po} />
          </div>
        }
      />

      <div className="space-y-4 pb-10">

        {/* ── Financial summary + urgency ─────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="flex divide-x divide-rule">
            <StatCard label="Ordered" value={formatINR(orderedValue)} />
            <StatCard label="Received" value={formatINR(receivedValue)} highlight={receivedValue > 0n ? "good" : undefined} />
            <StatCard label="Pending"  value={formatINR(pendingValue)}  highlight={pendingValue > 0n ? "warn" : undefined} />
            {urgency && (
              <div className="flex-1 px-6 py-4 flex flex-col justify-center">
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">Expected by</div>
                <div className="text-[14px] font-semibold text-text tabular">{formatDate(po.expectedAt!)}</div>
                <span className={`mt-2 self-start text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${urgencyClass[urgency.level]}`}>
                  {urgency.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Lines table ─────────────────────────────────────────────────── */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-rule text-[11px] uppercase tracking-[0.12em] text-text-dim">
                <Th>Colourway</Th>
                <Th align="right">Ordered</Th>
                <Th align="right">Received</Th>
                <Th align="right">Pending</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => {
                const pendingNum = parseFloat(l.pendingQty);
                const unitShort  = l.unit.toLowerCase();
                const lineAmount = BigInt(Math.round(Number(l.rate) * parseFloat(l.orderedQty)));
                return (
                  <tr key={l.id} className="border-b border-rule/70 last:border-0">
                    <Td>
                      <div className="font-medium text-text">{l.colourwayCode}</div>
                      <div className="text-[12px] text-text-dim mt-0.5">{l.colourName} · {l.designCode}</div>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text">{l.orderedQty}</span>{" "}
                      <span className="text-text-dim text-[11.5px]">{unitShort}</span>
                    </Td>
                    <Td align="right"><span className="tabular text-good font-medium">{l.receivedQty}</span></Td>
                    <Td align="right">
                      <span className={`tabular font-medium ${pendingNum > 0 ? "text-warn" : "text-text-dim"}`}>
                        {l.pendingQty}
                      </span>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(lineAmount)}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Status actions ──────────────────────────────────────────────── */}
        <POStatusActions poId={po.id} status={po.status} vendorName={po.vendorName} />

        {/* ── Vendor payment ──────────────────────────────────────────────── */}
        {vendorExpense && (
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Vendor payment</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[18px] font-semibold tabular text-text">{formatINR(vendorExpense.amount)}</div>
                <div className="text-[11.5px] text-text-dim mt-0.5">
                  {vendorExpense.paidAt
                    ? `Paid ${formatDate(vendorExpense.paidAt)}`
                    : vendorExpense.approvalState === "APPROVED"
                    ? "Approved — payment pending"
                    : "Pending approval"}
                </div>
              </div>
              {vendorExpense.approvalState === "APPROVED" && !vendorExpense.paidAt && (
                <MarkPaidButton expenseId={vendorExpense.id} />
              )}
              {vendorExpense.paidAt && (
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[11px] font-medium bg-good/10 text-good border border-good/20">
                  Paid
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── GRN history ─────────────────────────────────────────────────── */}
        {po.grns.length > 0 && (
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-dim mb-3">
              GRN history ({po.grns.length})
            </div>
            <ul className="divide-y divide-rule/60">
              {po.grns.map((g) => (
                <li key={g.id} className="flex items-center gap-4 py-3.5">
                  <div className="tabular text-[13.5px] text-text w-[220px]">{g.number}</div>
                  <div className="text-[12.5px] text-text-dim w-[110px] tabular">{formatDate(g.receivedAt)}</div>
                  <div className="text-[12.5px] text-text-dim flex-1">
                    {g.invoiceRef && <span>ref {g.invoiceRef}</span>}
                  </div>
                  <div className="text-[12.5px] text-text-dim tabular">{g.lineCount} line{g.lineCount === 1 ? "" : "s"}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "warn" }) {
  const valueClass = highlight === "good" ? "text-good" : highlight === "warn" ? "text-warn" : "text-text";
  return (
    <div className="flex-1 px-6 py-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">{label}</div>
      <div className={`text-[18px] font-semibold tabular ${valueClass}`}>{value}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[42px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-3.5 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
