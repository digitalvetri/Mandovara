import Link from "next/link";
import type { Route } from "next";
import { formatINR } from "@/kernel/money/format";
import type { BalanceRow } from "@/modules/inventory/queries";

export function BalancesTable({ rows, canSeeValue }: { rows: BalanceRow[]; canSeeValue: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No stock balances in this view.</div>
        <p className="text-[12px] text-text-dim">
          Post a GRN or an opening-stock adjustment to seed inventory. →{" "}
          <Link href={"/inventory/adjust" as Route} className="text-accent hover:underline">
            New adjustment
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
            <Th>Product</Th>
            <Th>Warehouse</Th>
            <Th align="right">On hand</Th>
            <Th align="right">Reserved</Th>
            <Th align="right">Available</Th>
            <Th align="right">Reorder</Th>
            {canSeeValue && <Th align="right">Value</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.warehouseId}:${r.productId}`} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
              <Td>
                <Link href={`/inventory/${r.productId}` as Route} className="text-text hover:text-accent">
                  <div className="tabular text-text-dim text-[11.5px]">{r.productCode}</div>
                  <div>{r.productName}</div>
                </Link>
              </Td>
              <Td className="text-text-dim">{r.warehouseName}</Td>
              <Td align="right"><span className="tabular text-text">{r.quantity} <span className="text-text-faint">{r.uom}</span></span></Td>
              <Td align="right">
                <span className={`tabular ${parseFloat(r.reserved) > 0 ? "text-warn" : "text-text-faint"}`}>
                  {parseFloat(r.reserved) > 0 ? r.reserved : "—"}
                </span>
              </Td>
              <Td align="right">
                <span className={`tabular ${r.isLow ? "text-bad" : "text-text"}`}>{r.available}</span>
              </Td>
              <Td align="right">
                <span className="tabular text-text-dim">{r.reorderLevel ?? "—"}</span>
                {r.isLow && <div className="text-[9.5px] text-bad uppercase">Low</div>}
              </Td>
              {canSeeValue && (
                <Td align="right"><span className="tabular text-text-dim">{formatINR(r.value)}</span></Td>
              )}
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
