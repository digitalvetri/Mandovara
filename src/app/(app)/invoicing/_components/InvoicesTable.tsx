"use client";

// The invoice list, as a table.
//
// Rebuilt 2026-08-29 to the owner's spec: Invoice #, Client, Project/SO,
// Invoice Date, Status, Amount — and a ⋮ menu on the right of every row
// with exactly three entries. It replaced a two-line card layout that
// read well on a phone but made a hundred invoices impossible to scan,
// which is what a billing list is for.
//
// Delete is deliberately worded per row. A DRAFT can genuinely be
// deleted; an issued tax invoice cannot, and the menu says "Cancel
// invoice" there instead of offering something the server will refuse.
// See modules/invoices/actions-delete.ts for why.

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useTransition, useState } from "react";
import { Eye, Download, Trash2, Ban } from "lucide-react";
import { EmptyState } from "@/components/data/DataTable";
import { MoreMenu, type MenuItem } from "@/components/data/MoreMenu";
import type { InvoiceRow } from "@/modules/invoices/queries";
import { deleteInvoice } from "@/modules/invoices/actions-delete";
import { StatusPill } from "./StatusPill";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function fmtINR(p: bigint | string): string {
  const n = typeof p === "bigint" ? p : BigInt(p);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const s = (abs / 100n).toString();
  const grouped = s.length <= 3
    ? s
    : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);
  return `${neg ? "−" : ""}₹${grouped}`;
}

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No invoices in this view."
        body="Invoices are raised from an Order after installation or an approved milestone. Head to the Orders module to bill one."
      />
    );
  }

  function remove(row: InvoiceRow) {
    setError(null);
    start(async () => {
      const r = await deleteInvoice({ id: row.id });
      if (!r.ok) setError(r.error ?? "Could not delete that invoice.");
      else router.refresh();
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-[8px] border border-heat/40 bg-heat/8 px-4 py-2.5 text-[13px] text-heat" role="alert">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-rule bg-surface">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-rule text-left">
              <Th>Invoice #</Th>
              <Th>Client</Th>
              <Th>Project/SO</Th>
              <Th>Invoice Date</Th>
              <Th>Status</Th>
              <Th align="right">Amount</Th>
              <th className="w-[44px]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/60">
            {rows.map((r) => {
              const isDraft = r.status === "DRAFT";
              const items: MenuItem[] = [
                { key: "view", label: "View", icon: Eye, href: `/invoicing/${r.id}` },
                { key: "download", label: "Download", icon: Download, href: `/api/invoicing/${r.id}/pdf` },
                isDraft
                  ? {
                      key: "delete", label: "Delete", icon: Trash2, danger: true,
                      confirm: `Delete draft ${r.number}? This cannot be undone.`,
                      confirmLabel: "Delete",
                      onClick: () => remove(r),
                    }
                  : {
                      key: "cancel", label: "Cancel invoice", icon: Ban, danger: true,
                      href: `/invoicing/${r.id}`,
                    },
              ];

              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/invoicing/${r.id}` as Route)}
                  className="group cursor-pointer transition-colors hover:bg-surface-2/60"
                >
                  <Td className="font-medium tabular-nums text-text">{r.number}</Td>
                  <Td className="text-text">{r.clientName}</Td>
                  <Td className="text-text-dim">
                    {r.projectName ?? r.orderNumber ?? "—"}
                  </Td>
                  <Td className="tabular-nums text-text-dim">{fmtDate(r.date)}</Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td align="right" className="font-semibold tabular-nums text-text">
                    {fmtINR(r.total)}
                  </Td>
                  <td
                    className="px-2 py-3 text-right"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <MoreMenu items={items} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-dim ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children, className, align,
}: { children?: React.ReactNode; className?: string; align?: "right" }) {
  return (
    <td className={`px-4 py-3.5 text-[13.5px] ${align === "right" ? "text-right" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}
