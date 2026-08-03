import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { ProductRow } from "@/modules/products/queries";
import { StatusPill } from "./StatusPill";

export function ProductsTable({ rows, canSeeCost }: { rows: ProductRow[]; canSeeCost: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No products yet.</div>
        <p className="text-[12px] text-text-dim">
          Add SKUs manually or via Excel import (Session 4). →{" "}
          <Link href={"/products/new" as Route} className="text-accent hover:underline">
            New product
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
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th>HSN</Th>
            <Th align="right">GST %</Th>
            <Th align="right">MRP</Th>
            {canSeeCost && <Th align="right">Cost</Th>}
            <Th>UOM</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/products/${r.id}` as Route} className="text-text hover:text-accent tabular">
                  {r.code}
                </Link>
              </Td>
              <Td>{r.name}</Td>
              <Td className="text-text-dim">{r.categoryName}</Td>
              <Td><span className="tabular text-text-dim">{r.hsn}</span></Td>
              <Td align="right"><span className="tabular text-text-dim">{r.gstRate.toFixed(0)}%</span></Td>
              <Td align="right"><span className="tabular text-text">{r.mrp ? formatINR(r.mrp) : "—"}</span></Td>
              {canSeeCost && (
                <Td align="right"><span className="tabular text-text-dim">{r.cost ? formatINR(r.cost) : "—"}</span></Td>
              )}
              <Td className="text-text-dim">{r.uom}</Td>
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
