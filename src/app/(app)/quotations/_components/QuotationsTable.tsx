import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { QuotationRow } from "@/modules/quotations/queries";
import { StatusPill } from "./StatusPill";

export function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No quotations yet.</div>
        <p className="text-[12px] text-text-dim">
          Create a quote from a lead or straight from a client. →{" "}
          <Link href={"/quotations/new" as Route} className="text-accent hover:underline">
            New quotation
          </Link>
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
            <Th align="right">Lines</Th>
            <Th>Date</Th>
            <Th>Valid until</Th>
            <Th align="right">Total</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/quotations/${r.id}` as Route} className="text-text hover:text-accent tabular">
                  {r.number}
                </Link>
              </Td>
              <Td>{r.clientName}</Td>
              <Td align="right"><span className="tabular text-text-dim">{r.lineCount}</span></Td>
              <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
              <Td className="text-text-dim tabular">{formatDate(r.validUntil)}</Td>
              <Td align="right"><span className="tabular text-text">{formatINR(r.total)}</span></Td>
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
