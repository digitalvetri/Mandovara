// /invoicing/new — pick an order to invoice.
//
// Mandovara invoices are always minted from an existing Order, so this
// page is a shortlist of open orders (with client + total + line count)
// each with a one-click "Create Invoice" button that mints the invoice
// via createInvoiceFromOrder and routes to /invoicing/{id}.
//
// Landing here from the /invoicing "New Invoice" button — the confusing
// previous behaviour was to dump the user on /orders and expect them
// to hunt for the right one. This is explicit: only invoiceable orders,
// nothing else.

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { listOrders } from "@/modules/orders/queries";
import { CreateInvoiceButton } from "../../orders/_components/CreateInvoiceButton";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const ctx = await devContext();

  // "OPEN" filter = orders still in play (not COMPLETED / CANCELLED).
  // Fetch a healthy page so the picker isn't hiding options.
  const { rows } = await listOrders(ctx, {
    status:   "OPEN",
    sort:     "recent",
    pageSize: 50,
  });

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
        title="New Invoice"
        eyebrow="Pick the order you want to bill. The invoice pulls its lines, client and totals from that order."
      />

      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-rule bg-surface py-16 text-center">
          <div className="text-[14px] text-text mb-2">No orders ready to invoice.</div>
          <p className="text-[12px] text-text-dim">
            Confirm an order first — invoices are minted from orders, not created standalone.{" "}
            <Link href={"/orders" as Route} className="text-accent hover:underline">Open orders →</Link>
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Order</Th>
                <Th>Client</Th>
                <Th align="right">Total</Th>
                <Th>Date</Th>
                <Th align="right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                  <Td>
                    <Link href={`/orders/${r.id}` as Route} className="tabular text-text hover:text-accent">
                      {r.number}
                    </Link>
                  </Td>
                  <Td>{r.clientName}</Td>
                  <Td align="right"><span className="tabular text-text">{formatINR(r.totalValue)}</span></Td>
                  <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
                  <Td align="right"><CreateInvoiceButton orderId={r.id} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
