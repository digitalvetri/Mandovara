import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getOrder } from "@/modules/orders/queries";
import { StatusPill } from "../_components/StatusPill";
import { DispatchForm } from "../_components/DispatchForm";
import { CreateInvoiceButton } from "../_components/CreateInvoiceButton";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const o = await getOrder(ctx, id);
  if (!o) notFound();

  return (
    <>
      <Topbar
        title={o.number}
        eyebrow={`${o.clientName} · ${formatDate(o.date)}${o.deliveryBy ? ` → deliver by ${formatDate(o.deliveryBy)}` : ""}${o.quotationNumber ? ` · from ${o.quotationNumber}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={o.status} />
              {o.quotationNumber && o.quotationId && (
                <Link href={`/quotations/${o.quotationId}` as Route}
                      className="text-[11.5px] text-text-dim hover:text-accent tabular">
                  ← {o.quotationNumber}
                </Link>
              )}
            </div>
            {(o.status === "CONFIRMED" || o.status === "PARTIAL_DISPATCH" || o.status === "DISPATCHED") && (
              <CreateInvoiceButton orderId={o.id} />
            )}
          </div>

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th align="right">#</Th>
                  <Th>Product</Th>
                  <Th align="right">Ordered</Th>
                  <Th align="right">Dispatched</Th>
                  <Th align="right">Pending</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => {
                  const orderedNum = parseFloat(l.orderedQty);
                  const dispNum = parseFloat(l.dispatchedQty);
                  const pct = orderedNum === 0 ? 0 : Math.min(100, (dispNum / orderedNum) * 100);
                  return (
                    <tr key={l.id} className="border-b border-rule/70 last:border-0 align-top">
                      <Td align="right"><span className="tabular text-text-dim">{l.lineNo}</span></Td>
                      <Td>
                        <div className="tabular text-text-dim text-[11.5px]">{l.productCode}</div>
                        <div className="text-text">{l.description}</div>
                        <div className="mt-1.5 h-[3px] w-[160px] bg-rule/70 rounded-full overflow-hidden">
                          <div className="h-full bg-good rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </Td>
                      <Td align="right"><span className="tabular text-text">{l.orderedQty} <span className="text-text-faint">{l.uom}</span></span></Td>
                      <Td align="right"><span className="tabular text-good">{l.dispatchedQty}</span></Td>
                      <Td align="right"><span className={`tabular ${parseFloat(l.pendingQty) > 0 ? "text-warn" : "text-text-dim"}`}>{l.pendingQty}</span></Td>
                      <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                      <Td align="right"><span className="tabular text-text">{formatINR(l.amount)}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {o.status !== "CANCELLED" && (
            <DispatchForm orderId={o.id} lines={o.lines} />
          )}

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
                Dispatch history ({o.dispatches.length})
              </div>
            </div>
            {o.dispatches.length === 0 ? (
              <div className="text-[12px] text-text-faint">No dispatches posted yet.</div>
            ) : (
              <ul className="divide-y divide-rule/60">
                {o.dispatches.map((d) => (
                  <li key={d.id} className="flex items-center gap-4 py-3">
                    <div className="tabular text-[12.5px] text-text w-[220px]">{d.number}</div>
                    <div className="text-[11.5px] text-text-dim w-[110px] tabular">{formatDate(d.dispatchedAt)}</div>
                    <div className="text-[11.5px] text-text-dim flex-1">
                      {d.vehicleNumber && <span className="tabular mr-2">{d.vehicleNumber}</span>}
                      {d.transporter && <span>{d.transporter}</span>}
                      {!d.vehicleNumber && !d.transporter && <span className="text-text-faint">No vehicle info</span>}
                    </div>
                    <div className="text-[11.5px] text-text-dim tabular">{d.lineCount} line{d.lineCount === 1 ? "" : "s"}</div>
                    <StatusPill status={d.status} kind="dispatch" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Totals</div>
            <dl className="space-y-2 text-[12.5px]">
              <Row k="Taxable" v={formatINR(o.taxableAmount)} />
              {o.igst > 0n ? (
                <Row k="IGST" v={formatINR(o.igst)} />
              ) : (
                <>
                  <Row k="CGST" v={formatINR(o.cgst)} />
                  <Row k="SGST" v={formatINR(o.sgst)} />
                </>
              )}
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Grand total</dt>
                <dd className="font-display text-[20px] font-semibold text-text tabular-nums">{formatINR(o.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Party + branch</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Client" v={o.clientName} />
              <Row k="Mobile" v={o.clientMobile} mono />
              <Row k="Client state" v={o.clientStateCode} mono />
              <Row k="From branch" v={o.branchName} />
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
function Td({
  children, align = "left",
}: { children: React.ReactNode; align?: "left" | "right" }) {
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
