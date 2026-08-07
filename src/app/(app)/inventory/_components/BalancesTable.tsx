"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo } from "react";
import { formatINR } from "@/kernel/money/format";
import type { BalanceRow } from "@/modules/inventory/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";

export function BalancesTable({
  rows, canSeeValue,
}: { rows: BalanceRow[]; canSeeValue: boolean }) {
  // Stock value is behind RBAC (accounts/owner only) — build columns dynamically.
  const columns = useMemo<readonly Column<BalanceRow>[]>(() => {
    const base: Column<BalanceRow>[] = [
      {
        key: "product", header: "Product",
        render: (r) => (
          <>
            <div className="tabular text-text-dim text-[11.5px]">{r.productCode}</div>
            <div className="text-text">{r.productName}</div>
          </>
        ),
      },
      { key: "warehouse", header: "Warehouse", cellClassName: "text-text-dim", render: (r) => r.warehouseName },
      { key: "quantity", header: "On hand", align: "right",
        render: (r) => <span className="tabular text-text">{r.quantity} <span className="text-text-faint">{r.uom}</span></span> },
      {
        key: "reserved", header: "Reserved", align: "right",
        render: (r) => (
          <span className={`tabular ${parseFloat(r.reserved) > 0 ? "text-warn" : "text-text-faint"}`}>
            {parseFloat(r.reserved) > 0 ? r.reserved : "—"}
          </span>
        ),
      },
      {
        key: "available", header: "Available", align: "right",
        render: (r) => <span className={`tabular ${r.isLow ? "text-bad" : "text-text"}`}>{r.available}</span>,
      },
      {
        key: "reorder", header: "Reorder", align: "right",
        render: (r) => (
          <>
            <span className="tabular text-text-dim">{r.reorderLevel ?? "—"}</span>
            {r.isLow && <div className="text-[9.5px] text-bad uppercase">Low</div>}
          </>
        ),
      },
    ];
    if (canSeeValue) {
      base.push({
        key: "value", header: "Value", align: "right",
        render: (r) => <span className="tabular text-text-dim">{formatINR(r.value)}</span>,
      });
    }
    return base;
  }, [canSeeValue]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.warehouseId}:${r.productId}`}
      rowHref={(r) => `/inventory/${r.productId}`}
      ariaLabel="Stock balances"
      emptyState={
        <EmptyState
          title="No stock balances in this view."
          body={
            <>
              Post a GRN or an opening-stock adjustment to seed inventory. →{" "}
              <Link href={"/inventory/adjust" as Route} className="text-accent hover:underline">
                New adjustment
              </Link>
            </>
          }
        />
      }
    />
  );
}
