import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getPO } from "@/modules/purchase/queries";
import { POStatusPill } from "../_components/StatusPill";
import { GRNForm } from "../_components/GRNForm";

export const dynamic = "force-dynamic";

export default async function PODetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const po = await getPO(ctx, id);
  if (!po) notFound();

  return (
    <>
      <Topbar
        title={po.number}
        eyebrow={`${po.vendorName} · ${po.vendorMobile} · ${formatDate(po.date)}${po.expectedAt ? ` → expected by ${formatDate(po.expectedAt)}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center gap-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
            <POStatusPill status={po.status} />
          </div>

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th>Colourway</Th>
                  <Th>Unit</Th>
                  <Th align="right">Ordered</Th>
                  <Th align="right">Received</Th>
                  <Th align="right">Pending</Th>
                  <Th align="right">Rate</Th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const orderedNum = parseFloat(l.orderedQty);
                  const recNum = parseFloat(l.receivedQty);
                  const pct = orderedNum === 0 ? 0 : Math.min(100, (recNum / orderedNum) * 100);
                  const pendingNum = parseFloat(l.pendingQty);
                  return (
                    <tr key={l.id} className="border-b border-rule/70 last:border-0 align-top">
                      <Td>
                        <div className="tabular text-text">{l.colourwayCode}</div>
                        <div className="text-[11.5px] text-text-dim">{l.colourName} · {l.designCode}</div>
                        <div className="mt-1.5 h-[3px] w-[160px] bg-rule/70 rounded-full overflow-hidden">
                          <div className="h-full bg-good rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </Td>
                      <Td><span className="text-text-dim text-[11px] uppercase">{l.unit}</span></Td>
                      <Td align="right"><span className="tabular text-text">{l.orderedQty}</span></Td>
                      <Td align="right"><span className="tabular text-good">{l.receivedQty}</span></Td>
                      <Td align="right">
                        <span className={`tabular ${pendingNum > 0 ? "text-warn" : "text-text-dim"}`}>
                          {l.pendingQty}
                        </span>
                      </Td>
                      <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {po.status !== "CANCELLED" && po.status !== "RECEIVED" && (
            <GRNForm purchaseOrderId={po.id} lines={po.lines} />
          )}

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              GRN history ({po.grns.length})
            </div>
            {po.grns.length === 0 ? (
              <div className="text-[12px] text-text-faint">No GRNs posted yet.</div>
            ) : (
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
            )}
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Total</div>
            <div className="font-display text-[24px] font-semibold text-text tabular-nums">
              {formatINR(po.totalValue)}
            </div>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Vendor</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Name"   v={po.vendorName} />
              <Row k="Mobile" v={po.vendorMobile} mono />
            </dl>
          </div>
        </aside>
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
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
