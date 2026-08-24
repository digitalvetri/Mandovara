import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getPO } from "@/modules/purchase/queries";
import { POStatusPill } from "../_components/StatusPill";
import { SendOnWhatsAppButton } from "./_components/SendOnWhatsAppButton";
import { POStatusActions } from "./_components/POStatusActions";

export const dynamic = "force-dynamic";

export default async function PODetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const po = await getPO(ctx, id);
  if (!po) notFound();

  // Receipt progress
  const units = [...new Set(po.lines.map((l) => l.unit))];
  const sameUnit = units.length === 1;
  const unitLabel = sameUnit ? (units[0] ?? "").toLowerCase() : null;
  const totalOrdered  = po.lines.reduce((s, l) => s + parseFloat(l.orderedQty),  0);
  const totalReceived = po.lines.reduce((s, l) => s + parseFloat(l.receivedQty), 0);
  const pct = totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0;

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

        {/* Receipt progress */}
        <div className="rounded-[14px] bg-surface border border-rule px-5 py-3.5 flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Receipt progress</span>
              <span className="text-[12px] text-text-dim tabular">
                <span className="text-text font-medium">{unitLabel ? totalReceived : po.lines.filter(l => parseFloat(l.pendingQty) <= 0).length}</span>
                {" / "}
                {unitLabel ? `${totalOrdered} ${unitLabel}` : `${po.lines.length} lines`}
                {" received"}
              </span>
            </div>
            <div className="h-[5px] bg-rule rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? "bg-good" : "bg-accent"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lines table */}
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
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
                const pendingNum  = parseFloat(l.pendingQty);
                const unitShort   = l.unit.toLowerCase();
                const lineAmount  = BigInt(Math.round(Number(l.rate) * parseFloat(l.orderedQty)));
                return (
                  <tr key={l.id} className="border-b border-rule/70 last:border-0 align-top">
                    <Td>
                      <div className="tabular text-text">{l.colourwayCode}</div>
                      <div className="text-[11.5px] text-text-dim">{l.colourName} · {l.designCode}</div>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-text">{l.orderedQty}</span>{" "}
                      <span className="text-text-dim text-[10.5px]">{unitShort}</span>
                    </Td>
                    <Td align="right"><span className="tabular text-good">{l.receivedQty}</span></Td>
                    <Td align="right">
                      <span className={`tabular ${pendingNum > 0 ? "text-warn" : "text-text-dim"}`}>
                        {l.pendingQty}
                      </span>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                    <Td align="right"><span className="tabular text-text">{formatINR(lineAmount)}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Status actions */}
        <POStatusActions poId={po.id} status={po.status} />

        {/* GRN history */}
        {po.grns.length > 0 && (
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              GRN history ({po.grns.length})
            </div>
            <ul className="divide-y divide-rule/60">
              {po.grns.map((g) => (
                <li key={g.id} className="flex items-center gap-4 py-3">
                  <div className="tabular text-[12.5px] text-text w-[220px]">{g.number}</div>
                  <div className="text-[11.5px] text-text-dim w-[110px] tabular">{formatDate(g.receivedAt)}</div>
                  <div className="text-[11.5px] text-text-dim flex-1">
                    {g.invoiceRef && <span>ref {g.invoiceRef}</span>}
                  </div>
                  <div className="text-[11.5px] text-text-dim tabular">{g.lineCount} line{g.lineCount === 1 ? "" : "s"}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
