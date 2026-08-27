"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { OrderRow } from "@/modules/orders/queries";
import { StatusPill } from "./StatusPill";

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No orders yet.</div>
        <p className="text-[12px] text-text-muted">
          Convert an accepted quotation to create your first order. →{" "}
          <Link href={"/quotations" as Route} className="text-gold hover:underline">
            Open Quotations
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
      <table className="min-w-[480px] w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            <Th>Number</Th>
            <Th>Client</Th>
            <Th>From quote</Th>
            <Th align="right">Lines</Th>
            <Th>Date</Th>
            <Th align="right">Total</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/orders/${r.id}` as Route)}
              className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Td>
                <Link
                  href={`/orders/${r.id}` as Route}
                  onClick={(e) => e.stopPropagation()}
                  className="text-text hover:text-gold tabular"
                >
                  {r.number}
                </Link>
              </Td>
              <Td>{r.clientName}</Td>
              <Td className="text-text-muted tabular text-[11.5px]">
                {r.quotationId ? (
                  <Link href={`/quotations/${r.quotationId}` as Route} className="hover:text-gold">
                    view
                  </Link>
                ) : "—"}
              </Td>
              <Td align="right"><span className="tabular text-text-muted">{r.lineCount}</span></Td>
              <Td className="text-text-muted tabular">{formatDate(r.date)}</Td>
              <Td align="right"><span className="tabular text-text">{formatINR(r.totalValue)}</span></Td>
              <Td><StatusPill status={r.status} /></Td>
            </tr>
          ))}
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
