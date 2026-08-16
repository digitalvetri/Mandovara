import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { PORow } from "@/modules/purchase/queries";
import { POStatusPill } from "./StatusPill";

export function POTable({ rows }: { rows: PORow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No purchase orders yet.</div>
        <p className="text-[12px] text-text-dim">
          Add a vendor and raise your first PO to start receiving stock. →{" "}
          <Link href={"/purchase/new" as Route} className="text-accent hover:underline">
            New purchase order
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
            <Th>Vendor</Th>
            <Th align="right">Total</Th>
            <Th>Expected by</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/purchase/${r.id}` as Route} className="text-text hover:text-accent tabular">
                  {r.number}
                </Link>
              </Td>
              <Td>{r.vendorName}</Td>
              <Td align="right"><span className="tabular text-text">{formatINR(r.totalValue)}</span></Td>
              <Td className="text-text-dim tabular">{r.expectedAt ? formatDate(r.expectedAt) : "—"}</Td>
              <Td><POStatusPill status={r.status} /></Td>
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
