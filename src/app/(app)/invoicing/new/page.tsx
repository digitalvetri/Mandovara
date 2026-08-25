// /invoicing/new — project-centric invoice picker.
//
// Invoices are always minted from an Order. This page shows projects that
// have a confirmed (non-COMPLETED, non-CANCELLED) order, grouped by project so
// the user thinks "I need to invoice Dr. Kannan's villa" not "order SO-2608-0042".
// The "Create Invoice" button calls createInvoiceFromOrder and routes to /invoicing/{id}.

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { listInvoiceableOrders } from "@/modules/orders/queries-part2";
import { CreateInvoiceButton } from "../../orders/_components/CreateInvoiceButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED:        "Confirmed",
  PROCUREMENT:      "Procuring",
  MAKE:             "In make",
  READY_TO_INSTALL: "Ready",
  INSTALLING:       "Installing",
};

export default async function NewInvoicePage() {
  const ctx  = await devContext();
  const rows = await listInvoiceableOrders(ctx);

  return (
    <>
      <div className="pt-4 pb-2">
        <Link
          href={"/invoicing" as Route}
          className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.14em] text-text-dim hover:text-text transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back to Invoices
        </Link>
      </div>

      <Topbar
        title="Create Invoice"
        eyebrow="Pick the project to bill — invoices pull their lines, rates and totals from the confirmed order."
      />

      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-rule bg-surface py-16 text-center">
          <div className="text-[14px] text-text mb-2">No projects ready to invoice.</div>
          <p className="text-[12px] text-text-dim">
            A project needs an accepted firm quotation before it can be invoiced.{" "}
            <Link href={"/projects" as Route} className="text-accent hover:underline">Open projects →</Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.orderId}
              className="flex items-center gap-4 rounded-[12px] border border-rule bg-surface px-5 py-4 hover:border-accent/40 transition-colors"
            >
              {/* project info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <Link
                    href={`/projects/${r.projectId}` as Route}
                    className="text-[13.5px] font-semibold text-text hover:text-accent truncate"
                  >
                    {r.projectName}
                  </Link>
                  <span className="text-[10.5px] tabular text-text-dim shrink-0">{r.projectNumber}</span>
                </div>

                <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
                  <span>{r.clientName}</span>
                  {r.siteCity && (
                    <>
                      <span className="text-rule">·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} className="shrink-0" />
                        {r.siteCity}
                      </span>
                    </>
                  )}
                  <span className="text-rule">·</span>
                  <Link
                    href={`/orders/${r.orderId}` as Route}
                    className="tabular hover:text-accent transition-colors"
                  >
                    {r.orderNumber}
                  </Link>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium
                    ${r.orderStatus === "READY_TO_INSTALL" ? "bg-solid/10 text-solid" :
                      r.orderStatus === "INSTALLING"       ? "bg-heat/10  text-heat"  :
                                                             "bg-surface-2 text-text-dim"}`}
                  >
                    {STATUS_LABEL[r.orderStatus] ?? r.orderStatus}
                  </span>
                </div>
              </div>

              {/* amount + action */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <div className="text-[13.5px] tabular font-semibold text-text">{formatINR(r.totalValue)}</div>
                  <div className="text-[10.5px] tabular text-text-dim">{formatDate(r.orderDate)}</div>
                </div>
                <CreateInvoiceButton orderId={r.orderId} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
