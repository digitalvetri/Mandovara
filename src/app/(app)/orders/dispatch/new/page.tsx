import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { getOrder } from "@/modules/orders/queries";
import { getDispatchableOrders } from "@/modules/orders/dispatch-queries";
import { StatusPill } from "../../_components/StatusPill";
import { DispatchForm } from "../../_components/DispatchForm";

export const dynamic = "force-dynamic";

interface SearchParams {
  orderId?: string;
  q?: string;
}

export default async function CreateDispatchPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const { orderId, q } = await searchParams;
  const ctx = await devContext();

  // ── Step 2: order selected — show dispatch form ─────────────────────────────
  if (orderId) {
    const order = await getOrder(ctx, orderId);
    if (!order) notFound();

    const allDispatched = order.lines.every((l) => parseFloat(l.remainingQty) <= 0);

    return (
      <>
        <Topbar
          title="Create Dispatch"
          eyebrow={`${order.number} · ${order.clientName}`}
        />
        <div className="max-w-[720px]">
          <Link
            href={"/orders/dispatch/new" as Route}
            className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-gold transition-colors mb-4"
          >
            <ArrowLeft size={12} />
            Back to order selection
          </Link>

          {/* Order header */}
          <div className="rounded-[14px] bg-surface border border-rule p-4 mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium tabular-nums text-text">{order.number}</div>
              <div className="text-[12px] text-text-muted mt-0.5">
                {order.clientName}
                {order.projectNumber && (
                  <> · <span className="tabular-nums">{order.projectNumber}</span></>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-[13px] text-text-muted">{formatINR(order.totalValue)}</span>
              <StatusPill status={order.status} />
            </div>
          </div>

          {allDispatched ? (
            <div className="rounded-[14px] bg-surface border border-rule p-10 text-center">
              <Truck size={24} className="text-solid mx-auto mb-3" />
              <p className="text-[13px] font-medium text-text">All items fully dispatched</p>
              <p className="text-[12px] text-text-muted mt-1">No remaining quantity on any line for this order.</p>
              <Link
                href={"/orders/dispatch/new" as Route}
                className="inline-flex items-center gap-1 mt-4 text-[12px] text-gold hover:underline"
              >
                Select a different order
              </Link>
            </div>
          ) : (
            <div className="rounded-[14px] bg-surface border border-rule p-5">
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted mb-4">
                Dispatch Details
              </div>
              <DispatchForm
                orderId={order.id}
                projectId={order.projectId}
                lines={order.lines}
                successRedirectPath="/orders?tab=dispatch"
              />
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Step 1: order selection ──────────────────────────────────────────────────
  const orders = await getDispatchableOrders(ctx);
  const filtered = q
    ? orders.filter(
        (o) =>
          o.number.toLowerCase().includes(q.toLowerCase()) ||
          o.clientName.toLowerCase().includes(q.toLowerCase()),
      )
    : orders;

  return (
    <>
      <Topbar
        title="Create Dispatch"
        eyebrow="Select a sales order to dispatch"
      />
      <div className="max-w-[900px]">
        <Link
          href={"/orders?tab=dispatch" as Route}
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft size={12} />
          Back to dispatch
        </Link>

        {/* Search */}
        <form className="mb-4">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search order number or client name…"
            className="w-full h-[36px] px-3 bg-surface border border-rule rounded-[8px] text-[12.5px] text-text placeholder:text-text-subtle outline-none focus:border-accent"
          />
        </form>

        {/* Order list */}
        {filtered.length === 0 ? (
          <div className="rounded-[14px] bg-surface border border-rule p-12 text-center">
            <Truck size={24} className="text-text-subtle mx-auto mb-3" />
            <p className="text-[13px] font-medium text-text-muted">
              {q ? `No orders matching "${q}"` : "No orders available for dispatch."}
            </p>
            <p className="text-[12px] text-text-subtle mt-1">
              Orders must be Confirmed, In Procurement, In Make, or Ready to Install.
            </p>
          </div>
        ) : (
          <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                  {["Order", "Client", "Status", "Value", "Lines", ""].map((h) => (
                    <th
                      key={h}
                      className={`px-4 h-[34px] font-medium first:pl-5 ${
                        h === "Value" || h === "Lines" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-2.5 pl-5">
                      <span className="font-medium tabular-nums text-text">{o.number}</span>
                      {o.promisedInstallAt && (
                        <div className="text-[10.5px] text-text-muted tabular-nums">
                          by{" "}
                          {o.promisedInstallAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text">{o.clientName}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">
                      {formatINR(o.totalValue)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">
                      {o.lineCount}
                    </td>
                    <td className="px-4 py-2.5 pr-5 text-right">
                      <Link
                        href={`/orders/dispatch/new?orderId=${o.id}` as Route}
                        className="inline-flex items-center h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors"
                        style={{ background: "var(--color-gold)", color: "var(--color-ink)" }}
                      >
                        Select
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
