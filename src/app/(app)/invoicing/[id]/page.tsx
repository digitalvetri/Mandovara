import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getInvoice } from "@/modules/invoices/queries";
import { IrnPill, StatusPill } from "../_components/StatusPill";
import { CancelInvoiceButton } from "../_components/CancelInvoiceButton";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const inv = await getInvoice(ctx, id);
  if (!inv) notFound();

  const isIntra = inv.supplierStateCode === inv.placeOfSupplyCode;
  const overdueDays = Math.floor((Date.now() - inv.dueDate.getTime()) / 86_400_000);
  const isOverdue = inv.status !== "PAID" && inv.status !== "CANCELLED" && overdueDays > 0;
  const canCancel = inv.status === "ISSUED" || inv.status === "DRAFT";

  return (
    <>
      <Topbar
        title={inv.number}
        eyebrow={`${inv.clientName} · ${formatDate(inv.date)} → due ${formatDate(inv.dueDate)}${inv.orderNumber ? ` · from ${inv.orderNumber}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={inv.status} />
              <IrnPill status={inv.irnStatus} />
              {isOverdue && (
                <span className="text-[11px] text-bad tabular">{overdueDays}d overdue</span>
              )}
              {inv.orderNumber && inv.orderId && (
                <Link href={`/orders/${inv.orderId}` as Route}
                      className="text-[11.5px] text-text-dim hover:text-accent tabular">
                  ← {inv.orderNumber}
                </Link>
              )}
            </div>
            {canCancel && (
              <CancelInvoiceButton id={inv.id} number={inv.number} createdAt={inv.date} />
            )}
          </div>

          {inv.status === "CANCELLED" && inv.cancelReason && (
            <div className="rounded-[14px] bg-bad/6 border border-bad/30 p-4 text-[12px] text-text">
              <span className="font-medium text-bad">Cancelled</span>
              {inv.cancelledAt && <span className="text-text-dim"> on {formatDate(inv.cancelledAt)}</span>}
              : {inv.cancelReason}
            </div>
          )}

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th align="right">#</Th>
                  <Th>Product</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Taxable</Th>
                  <Th align="right">GST%</Th>
                  {isIntra ? (
                    <>
                      <Th align="right">CGST</Th>
                      <Th align="right">SGST</Th>
                    </>
                  ) : (
                    <Th align="right">IGST</Th>
                  )}
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule/70 last:border-0 align-top">
                    <Td align="right"><span className="tabular text-text-dim">{l.lineNo}</span></Td>
                    <Td>
                      <div className="tabular text-text-dim text-[11.5px]">{l.hsn}</div>
                      <div className="text-text">{l.description}</div>
                    </Td>
                    <Td align="right"><span className="tabular">{trimZero(l.quantity)} <span className="text-text-faint">{l.unit}</span></span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                    <Td align="right"><span className="tabular text-text">{formatINR(l.taxable)}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{trimZero(l.gstRate)}%</span></Td>
                    {isIntra ? (
                      <>
                        <Td align="right"><span className="tabular text-text-dim">{formatINR(l.cgst)}</span></Td>
                        <Td align="right"><span className="tabular text-text-dim">{formatINR(l.sgst)}</span></Td>
                      </>
                    ) : (
                      <Td align="right"><span className="tabular text-text-dim">{formatINR(l.igst)}</span></Td>
                    )}
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(l.amount)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Totals</div>
            <dl className="space-y-2 text-[12.5px]">
              <Row k="Taxable" v={formatINR(inv.taxableAmount)} />
              {isIntra ? (
                <>
                  <Row k="CGST" v={formatINR(inv.cgst)} />
                  <Row k="SGST" v={formatINR(inv.sgst)} />
                </>
              ) : (
                <Row k="IGST" v={formatINR(inv.igst)} />
              )}
              <Row k="Round-off" v={formatINR(inv.roundOff)} />
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Invoice total</dt>
                <dd className="font-display text-[20px] font-semibold text-text tabular-nums">{formatINR(inv.total)}</dd>
              </div>
              {inv.advanceAdjusted > 0n && (
                <Row k="Advance adjusted" v={`(${formatINR(inv.advanceAdjusted).replace("₹","₹")})`} />
              )}
              {inv.paidTotal > 0n && (
                <Row k="Received" v={formatINR(inv.paidTotal)} />
              )}
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Outstanding</dt>
                <dd className={`font-display text-[18px] font-semibold tabular-nums ${inv.outstanding > 0n ? "text-text" : "text-text-faint"}`}>
                  {inv.outstanding > 0n ? formatINR(inv.outstanding) : "₹0"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Client + supply</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Client" v={inv.clientName} />
              <Row k="Mobile" v={inv.clientMobile} mono />
              <Row k="Client GSTIN" v={inv.clientGstin ?? "—"} mono />
              <Row k="Place of supply" v={inv.placeOfSupplyCode} mono />
              <Row k="Supplier state" v={inv.supplierStateCode} mono />
              <Row k="Supply type" v={isIntra ? "Intra-state" : "Inter-state"} />
              <Row k="Type" v={inv.type} />
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">E-invoice / IRN</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="IRN" v={inv.irn ?? "—"} mono />
              <Row k="Ack no." v={inv.ackNo ?? "—"} mono />
              <Row k="Ack date" v={inv.ackDate ? formatDate(inv.ackDate) : "—"} />
            </dl>
            <p className="mt-3 text-[10.5px] text-text-faint">
              IRN generation via GSP lands in the backend pass. Currently marked NOT_REQUIRED for demo.
            </p>
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
function trimZero(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
