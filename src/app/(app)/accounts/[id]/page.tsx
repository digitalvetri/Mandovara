import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getReceipt } from "@/modules/receipts/queries";
import { ModePill } from "../_components/ModePill";
import { ChequeActionButtons } from "../_components/ChequeActionButtons";

export const dynamic = "force-dynamic";

export default async function ReceiptDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const r = await getReceipt(ctx, id);
  if (!r) notFound();

  const applied = r.amount - r.unallocated;

  return (
    <>
      <Topbar
        title={r.number}
        eyebrow={`${r.clientName} · ${formatDate(r.date)} · ${r.mode}${r.reference ? ` · ref ${r.reference}` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ModePill mode={r.mode} />
              {r.chequeStatus && (
                <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim">
                  Cheque · {r.chequeStatus}
                </div>
              )}
            </div>
            <ChequeActionButtons receiptId={r.id} chequeStatus={r.chequeStatus} />
          </div>

          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <div className="px-4 py-2 border-b border-rule text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
              Which bills this covers ({r.allocations.length})
            </div>
            {r.allocations.length === 0 ? (
              <div className="overflow-x-auto px-6 py-8 text-center text-[12px] text-text-faint">
                {r.projectName ? (
                  <>
                    No bill yet — the whole {formatINR(r.amount)} counts against{" "}
                    <Link href={`/projects/${r.projectId}` as Route} className="text-accent hover:underline">
                      {r.projectName}
                    </Link>
                    . It moves onto the invoice when that job is billed.
                  </>
                ) : (
                  <>This payment is not linked to a job or a bill yet.</>
                )}
              </div>
            ) : (
              <table className="min-w-[480px] w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                    <Th>Invoice</Th>
                    <Th align="right">Invoice total</Th>
                    <Th align="right">Applied</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.allocations.map((a) => (
                    <tr key={a.id} className="border-b border-rule/70 last:border-0">
                      <Td>
                        <Link href={`/invoicing/${a.invoiceId}` as Route}
                              className="text-text hover:text-accent tabular">
                          {a.invoiceNumber}
                        </Link>
                      </Td>
                      <Td align="right"><span className="tabular text-text-dim">{formatINR(a.invoiceTotal)}</span></Td>
                      <Td align="right"><span className="tabular text-text font-medium">{formatINR(a.amount)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4 h-fit">
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Amounts</div>
            <dl className="space-y-2 text-[12.5px]">
              <Row k="Received" v={formatINR(r.amount)} />
              <Row k="On bills" v={formatINR(applied)} />
              <div className="pt-2 mt-2 border-t border-rule flex items-baseline justify-between">
                {/* Money against a job is placed, not stray — it is waiting
                    for the bill raised at the end of that job. Only money
                    with nothing behind it at all is worth a warning colour. */}
                <dt className={`uppercase text-[10.5px] tracking-[0.14em] ${
                  r.unallocated === 0n ? "text-text" : r.projectId ? "text-text" : "text-warn"
                }`}>
                  {r.unallocated === 0n ? "All on bills"
                    : r.projectId       ? "Against the job"
                    :                     "Not linked yet"}
                </dt>
                <dd className={`font-display text-[18px] font-semibold tabular-nums ${
                  r.unallocated === 0n ? "text-text-faint" : r.projectId ? "text-text" : "text-warn"
                }`}>
                  {r.unallocated > 0n ? formatINR(r.unallocated) : "₹0"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">Meta</div>
            <dl className="space-y-3 text-[12.5px]">
              <Row k="Reference" v={r.reference ?? "—"} mono />
              <Row k="Job" v={r.projectName ?? "—"} />
              <Row k="Recorded" v={formatDate(r.date)} />
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({
  children, align = "left",
}: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim text-[11.5px]">{k}</dt>
      <dd className={`text-text text-right ${mono ? "tabular" : ""}`}>{v}</dd>
    </div>
  );
}
