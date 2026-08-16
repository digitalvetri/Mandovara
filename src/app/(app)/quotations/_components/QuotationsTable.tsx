"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MoreHorizontal, Eye, Pencil, Download, MessageCircle, Copy, Check, Flame, AlertTriangle } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { QuotationRow } from "@/modules/quotations/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

function digitsOnly(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.startsWith("91") && d.length === 12 ? d : `91${d}`;
}

// ── Expiry cell ───────────────────────────────────────────────────────────────

function ExpiryDate({ row }: { row: QuotationRow }) {
  const date = formatDate(row.validUntil);
  if (row.expiryBucket === "ok") {
    return <span className="tabular text-text-dim">{date}</span>;
  }
  if (row.expiryBucket === "expired") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="tabular text-fault line-through">{date}</span>
        <span className="text-[10px] font-medium bg-fault/10 text-fault px-1.5 py-0.5 rounded-[3px]">Expired</span>
      </span>
    );
  }
  if (row.expiryBucket === "critical") {
    return (
      <span className="inline-flex items-center gap-1 text-fault">
        <Flame size={11} strokeWidth={2} />
        <span className="tabular font-medium">{date}</span>
      </span>
    );
  }
  // soon
  return (
    <span className="inline-flex items-center gap-1 text-heat">
      <AlertTriangle size={11} strokeWidth={2} />
      <span className="tabular">{date}</span>
    </span>
  );
}

// ── Row actions menu ──────────────────────────────────────────────────────────

function RowActions({ row }: { row: QuotationRow }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const canEdit = ["DRAFT", "REVISED"].includes(row.status);
  const link    = `/quotations/${row.id}`;
  const shortNum  = row.number.split("/").slice(-1)[0] ?? row.number;
  const waBody    = encodeURIComponent(`Namaste,\n\nPlease find quotation ${shortNum} at:\n${typeof window !== "undefined" ? window.location.origin : ""}${link}`);
  const waHref    = `https://wa.me/${digitsOnly(row.clientMobile)}?text=${waBody}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        typeof window !== "undefined" ? `${window.location.origin}${link}` : link,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  }

  const itemCls = "flex items-center gap-2.5 w-full px-3 py-2 text-[12.5px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors text-left";

  return (
    <div className="relative flex justify-end" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center justify-center w-7 h-7 rounded-[6px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
      >
        <MoreHorizontal size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-50 min-w-[168px] rounded-[10px] bg-surface border border-rule shadow-xl shadow-ink/40 py-1"
        >
          <Link
            href={`/quotations/${row.id}` as Route}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Eye size={13} strokeWidth={1.75} /> View
          </Link>

          {canEdit && (
            <Link
              href={`/quotations/${row.id}/edit` as Route}
              className={itemCls}
              onClick={() => setOpen(false)}
            >
              <Pencil size={13} strokeWidth={1.75} /> Edit
            </Link>
          )}

          <a
            href={`/api/quotations/${row.id}/pdf`}
            download
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Download size={13} strokeWidth={1.75} /> Download PDF
          </a>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <MessageCircle size={13} strokeWidth={1.75} /> WhatsApp
          </a>

          <button type="button" onClick={copyLink} className={itemCls}>
            {copied
              ? <><Check size={13} className="text-solid" /> Copied!</>
              : <><Copy size={13} strokeWidth={1.75} /> Copy link</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

const COLUMNS: readonly Column<QuotationRow>[] = [
  {
    key: "number",
    header: "Quotation No.",
    render: (r) => (
      <span className="font-data text-[13px] tabular text-text">{r.number}</span>
    ),
  },
  {
    key: "client",
    header: "Client",
    render: (r) => (
      <div>
        <div className="text-[13px] text-text font-medium leading-snug">{r.clientName}</div>
        <div className="text-[11.5px] text-text-dim mt-0.5 truncate max-w-[180px]">{r.projectName}</div>
      </div>
    ),
  },
  {
    key: "items",
    header: "Items",
    align: "right",
    render: (r) => <span className="tabular text-[13px] text-text-dim">{r.lineCount}</span>,
  },
  {
    key: "date",
    header: "Created",
    cellClassName: "text-text-dim tabular text-[12.5px]",
    render: (r) => formatDate(r.date),
  },
  {
    key: "valid",
    header: "Valid Until",
    render: (r) => <ExpiryDate row={r} />,
  },
  {
    key: "total",
    header: "Amount",
    align: "right",
    render: (r) => (
      <span className="tabular font-semibold text-[13.5px] text-text">{formatINR(r.total)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusPill status={r.status} />,
  },
  {
    key: "owner",
    header: "Owner",
    cellClassName: "text-text-dim text-[12.5px]",
    render: (r) => r.ownerName,
  },
  {
    key: "actions",
    header: "",
    render: (r) => <RowActions row={r} />,
  },
];

export function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/quotations/${r.id}`}
      ariaLabel="Quotations"
      emptyState={
        <EmptyState
          title="No quotations found."
          body={
            <>
              Try adjusting your filters, or{" "}
              <Link href={"/quotations/new" as Route} className="text-accent hover:underline">
                create a new quotation
              </Link>
              .
            </>
          }
        />
      }
    />
  );
}
