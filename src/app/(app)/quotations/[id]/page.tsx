import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getQuotation } from "@/modules/quotations/queries";
import { StatusPill } from "../_components/StatusPill";
import { StatusChanger } from "../_components/StatusChanger";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const q = await getQuotation(ctx, id);
  if (!q) notFound();

  const isIntraState = q.supplierStateCode === q.clientStateCode;

  return (
    <>
      <Topbar
        title={q.number}
        eyebrow={`${q.clientName} · ${q.clientMobile} · ${formatDate(q.date)} → valid until ${formatDate(q.validUntil)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">Status</div>
              <StatusPill status={q.status} />
              {q.revision > 0 && (
                <span className="text-[11px] text-text-dim tabular">R{q.revision}</span>
              )}
            </div>
            <StatusChanger id={q.id} current={q.status} />
          </div>

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <Th align="right">#</Th>
                  <Th>Product</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Disc %</Th>
                  <Th align="right">Taxable</Th>
                  <Th align="right">GST%</Th>
                  {isIntraState ? (
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
                {q.lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule/70 last:border-0">
                    <Td align="right"><span className="tabular text-text-dim">{l.lineNo}</span></Td>
                    <Td>
                      <div className="tabular text-text-dim text-[11.5px]">{l.productCode}</div>
                      <div className="text-text">{l.description}</div>
                    </Td>
                    <Td align="right"><span className="tabular">{trimTrailingZeros(l.quantity)} <span className="text-text-faint">{l.uom}</span></span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{formatINR(l.rate)}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{trimTrailingZeros(l.discountPct)}</span></Td>
                    <Td align="right"><span className="tabular text-text">{formatINR(l.taxable)}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{trimTrailingZeros(l.gstRate)}</span></Td>
                    {isIntraState ? (
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
              <Row k="Taxable" v={formatINR(q.taxableAmount)} />
              {isIntraState ? (
                <>
                  <Row k="CGST" v={formatINR(q.cgst)} />
                  <Row k="SGST" v={formatINR(q.sgst)} />
                </>
              ) : (
                <Row k="IGST" v={formatINR(q.igst)} />
              )}
              <Row k="Round-off" v={formatINR(q.roundOff)} />
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                <dt className="text-text uppercase text-[10.5px] tracking-[0.14em]">Grand total</dt>
                <dd className="font-display text-[22px] font-semibold text-text tabular-nums">{formatINR(q.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Client + supply</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Client" v={q.clientName} />
              <Row k="Client state" v={q.clientStateCode} mono />
              <Row k="Client GSTIN" v={q.clientGstin ?? "—"} mono />
              <Row k="From branch" v={q.branchName} />
              <Row k="Supplier state" v={q.supplierStateCode} mono />
              <Row k="Supply type" v={isIntraState ? "Intra-state" : "Inter-state"} />
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
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>
      {children}
    </td>
  );
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
