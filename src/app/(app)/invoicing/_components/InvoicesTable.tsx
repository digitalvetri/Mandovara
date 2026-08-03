import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { InvoiceRow } from "@/modules/invoices/queries";
import { IrnPill, StatusPill } from "./StatusPill";

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No invoices in this view.</div>
        <p className="text-[12px] text-text-dim">
          Invoices are minted from a Sales Order once goods are dispatched.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <Th>Number</Th>
            <Th>Client</Th>
            <Th>Order</Th>
            <Th>Date</Th>
            <Th>Due</Th>
            <Th align="right">Total</Th>
            <Th align="right">Outstanding</Th>
            <Th>Status</Th>
            <Th>IRN</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const overdue = r.status !== "CANCELLED" && r.status !== "PAID" && r.overdueBy > 0;
            return (
              <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                <Td>
                  <Link href={`/invoicing/${r.id}` as Route} className="text-text hover:text-accent tabular">
                    {r.number}
                  </Link>
                </Td>
                <Td>{r.clientName}</Td>
                <Td className="text-text-dim tabular text-[11.5px]">{r.orderNumber ?? "—"}</Td>
                <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
                <Td className={overdue ? "tabular text-bad" : "text-text-dim tabular"}>
                  {formatDate(r.dueDate)}
                  {overdue && <div className="text-[10px] text-bad">{r.overdueBy}d late</div>}
                </Td>
                <Td align="right"><span className="tabular text-text">{formatINR(r.total)}</span></Td>
                <Td align="right">
                  <span className={`tabular ${r.outstanding > 0n ? "text-text" : "text-text-faint"}`}>
                    {r.outstanding > 0n ? formatINR(r.outstanding) : "—"}
                  </span>
                </Td>
                <Td><StatusPill status={r.status} /></Td>
                <Td><IrnPill status={r.irnStatus} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
