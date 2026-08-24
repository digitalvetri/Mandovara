import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { getOrder } from "@/modules/orders/queries";
import { StatusPill } from "../_components/StatusPill";
import { CreateInvoiceButton } from "../_components/CreateInvoiceButton";
import { OrderStatusActions } from "./_components/OrderStatusActions";

export const dynamic = "force-dynamic";

// ── Workflow timeline stages (order matters) ──────────────────────────────────
const TIMELINE = [
  { key: "CONFIRMED",        label: "Confirmed"   },
  { key: "PROCUREMENT",      label: "Procurement" },
  { key: "MAKE",             label: "Make"        },
  { key: "COMPLETED",        label: "Completed"   },
] as const;

type _TimelineKey = typeof TIMELINE[number]["key"];

function timelineIndex(status: string): number {
  return TIMELINE.findIndex((s) => s.key === status);
}

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const o = await getOrder(ctx, id);
  if (!o) notFound();

  const currentIdx = timelineIndex(o.status);
  const isCancelled = o.status === "CANCELLED";
  const isDone      = o.status === "COMPLETED";
  const canEdit     = !isDone && !isCancelled;

  const balance     = o.totalValue - o.paidTotal;
  const installDate = "";

  return (
    <>
      <Topbar
        title={o.number}
        eyebrow={`${o.clientName} · ${formatDate(o.date)}${installDate}${o.quotationNumber ? ` · from ${o.quotationNumber}` : ""}`}
      />

      {/* ── Workflow timeline ─────────────────────────────────────────── */}
      {!isCancelled && (
        <div className="rounded-[14px] bg-surface border border-rule px-5 py-4 mb-4 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max">
            {TIMELINE.map((step, i) => {
              const past    = currentIdx > i;
              const current = currentIdx === i;
              const _future  = currentIdx < i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-[8px] h-[8px] rounded-full border-2 transition-colors ${
                        current ? "border-gold bg-gold"
                        : past   ? "border-solid bg-solid"
                        :          "border-rule bg-surface-hover"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium tracking-[0.04em] whitespace-nowrap ${
                        current ? "text-gold"
                        : past   ? "text-solid"
                        :          "text-text-subtle"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div
                      className={`w-[40px] h-[2px] mx-1 mb-4 rounded-full ${past || current ? "bg-solid/50" : "bg-rule"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status row */}
          <div className="rounded-[14px] bg-surface border border-rule p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Status</div>
              <StatusPill status={o.status} />
              {o.quotationNumber && o.quotationId && (
                <Link
                  href={`/quotations/${o.quotationId}` as Route}
                  className="text-[11.5px] text-text-muted hover:text-gold tabular"
                >
                  ← {o.quotationNumber}
                </Link>
              )}
            </div>
            {canEdit && <CreateInvoiceButton orderId={o.id} />}
          </div>

          {/* Workflow advance */}
          <OrderStatusActions orderId={o.id} status={o.status} />

          {/* Lines table */}
          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                  <Th align="right">#</Th>
                  <Th>Item</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Procured</Th>
                  <Th align="right">Made</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => {
                  const qty  = parseFloat(l.quantity);
                  const made = parseFloat(l.madeQty);
                  const pct  = qty === 0 ? 0 : Math.min(100, (made / qty) * 100);
                  return (
                    <tr key={l.id} className="border-b border-rule/70 last:border-0 align-top">
                      <Td align="right"><span className="tabular text-text-muted">{l.lineNo}</span></Td>
                      <Td>
                        <div className="text-text">{l.description}</div>
                        <div className="mt-1.5 h-[3px] w-[160px] bg-rule/70 rounded-full overflow-hidden">
                          <div className="h-full bg-solid rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="tabular text-text">{l.quantity}</span>{" "}
                        <span className="text-text-subtle text-[11px]">{l.unit}</span>
                      </Td>
                      <Td align="right"><span className="tabular text-text-muted">{l.procuredQty}</span></Td>
                      <Td align="right"><span className="tabular text-text-muted">{l.madeQty}</span></Td>
                      <Td align="right"><span className="tabular text-text-muted">{formatINR(l.rate)}</span></Td>
                      <Td align="right"><span className="tabular text-text font-medium">{formatINR(l.amount)}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="space-y-4 h-fit">
          {/* Payment summary */}
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted mb-3">Payment</div>
            <div className="font-display text-[26px] font-semibold text-text tabular-nums leading-none mb-4">
              {formatINR(o.totalValue)}
            </div>
            <div className="space-y-2 text-[12.5px]">
              <Row k="Invoiced" v={formatINR(o.invoicedTotal)} dim={o.invoicedTotal === 0n} />
              <Row k="Paid"     v={formatINR(o.paidTotal)}     dim={o.paidTotal === 0n}     />
              <div className="pt-2 border-t border-rule/60">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-text-muted text-[11.5px]">Balance</dt>
                  <dd className={`font-medium tabular text-right ${balance > 0n ? "text-fault" : "text-solid"}`}>
                    {formatINR(balance)}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* Order details */}
          <div className="rounded-[14px] bg-surface border border-rule p-5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted mb-3">Order Details</div>
            <dl className="space-y-2.5 text-[12.5px]">
              <Row k="Client"    v={o.clientName} />
              <Row k="Mobile"    v={o.clientMobile} mono />
              <Row k="Project"   v={`${o.projectNumber} · ${o.projectName}`} />
              <Row k="Branch"    v={o.branchName} />
              {o.salesExecName && <Row k="Sales exec" v={o.salesExecName} />}
              {o.makeJobStatus && (
                <Row k="Make job" v={o.makeJobStatus.replace(/_/g, " ")} />
              )}
            </dl>
          </div>

          {/* Quick links */}
          <div className="rounded-[14px] bg-surface border border-rule p-4">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted mb-3">Links</div>
            <div className="space-y-1">
              <QuickLink href={`/projects/${o.projectId}` as Route} label="View Project" />
              {o.quotationId && (
                <QuickLink href={`/quotations/${o.quotationId}` as Route} label="View Quotation" />
              )}
              <QuickLink
                href={`https://wa.me/91${o.clientMobile.replace(/\D/g, "").slice(-10)}` as Route}
                label="WhatsApp Customer"
                external
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>
      {children}
    </td>
  );
}
function Row({ k, v, mono, dim }: { k: string; v: string; mono?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-muted text-[11.5px] shrink-0">{k}</dt>
      <dd className={`text-right break-all ${mono ? "tabular" : ""} ${dim ? "text-text-subtle" : "text-text"}`}>{v}</dd>
    </div>
  );
}
function QuickLink({ href, label, external }: { href: Route; label: string; external?: boolean }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-[6px] text-[12px] text-text-muted hover:text-gold hover:bg-surface-hover transition-colors"
    >
      {label}
      <span className="text-[10px] opacity-50">{external ? "↗" : "→"}</span>
    </Link>
  );
}
