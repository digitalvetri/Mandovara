import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { ReceiptRow } from "@/modules/receipts/queries";
import { ModePill } from "./ModePill";

export function ReceiptsTable({ rows }: { rows: ReceiptRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No receipts recorded yet.</div>
        <p className="text-[12px] text-text-dim">
          Record a payment against an outstanding invoice to get started. →{" "}
          <Link href={"/accounts/new" as Route} className="text-accent hover:underline">
            Record receipt
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
            <Th>Date</Th>
            <Th>Client</Th>
            <Th>Mode</Th>
            <Th>Reference</Th>
            <Th align="right">Applied</Th>
            <Th align="right">On account</Th>
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const applied = r.amount - r.unallocated;
            return (
              <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                <Td>
                  <Link href={`/accounts/${r.id}` as Route} className="text-text hover:text-accent tabular">
                    {r.number}
                  </Link>
                </Td>
                <Td className="text-text-dim tabular">{formatDate(r.date)}</Td>
                <Td>{r.clientName}</Td>
                <Td><ModePill mode={r.mode} /></Td>
                <Td className="text-text-dim tabular text-[11.5px]">{r.reference ?? "—"}</Td>
                <Td align="right"><span className="tabular text-text">{formatINR(applied)}</span></Td>
                <Td align="right">
                  <span className={`tabular ${r.unallocated > 0n ? "text-warn" : "text-text-faint"}`}>
                    {r.unallocated > 0n ? formatINR(r.unallocated) : "—"}
                  </span>
                </Td>
                <Td align="right"><span className="tabular text-text font-medium">{formatINR(r.amount)}</span></Td>
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
