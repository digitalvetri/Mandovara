"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  MoreHorizontal, Eye, Pencil, Download, MessageCircle, Copy, Check,
} from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { QuotationRow } from "@/modules/quotations/queries";
import { DataTable, EmptyState, type Column } from "@/components/data/DataTable";
import { StatusPill } from "./StatusPill";

function digitsOnly(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.startsWith("91") && d.length === 12 ? d : `91${d}`;
}

// ── More actions dropdown ─────────────────────────────────────────────────────

function MoreMenu({ row }: { row: QuotationRow }) {
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

  const link     = `/quotations/${row.id}`;
  const shortNum = row.number.split("/").slice(-1)[0] ?? row.number;
  const waBody   = encodeURIComponent(
    `Namaste,\n\nPlease find quotation ${shortNum} at:\n${typeof window !== "undefined" ? window.location.origin : ""}${link}`,
  );
  const waHref = `https://wa.me/${digitsOnly(row.clientMobile)}?text=${waBody}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        typeof window !== "undefined" ? `${window.location.origin}${link}` : link,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  }

  const itemCls =
    "flex items-center gap-2.5 w-full px-3 py-2 text-[12.5px] " +
    "text-text-dim hover:text-text hover:bg-surface-2 transition-colors text-left";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="More actions"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center justify-center w-7 h-7 rounded-[6px]
                   text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
      >
        <MoreHorizontal size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-50 min-w-[168px] rounded-[10px]
                     bg-surface border border-rule shadow-xl shadow-ink/40 py-1"
        >
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
            <MessageCircle size={13} strokeWidth={1.75} /> Send on WhatsApp
          </a>
          <button type="button" onClick={copyLink} className={itemCls}>
            {copied
              ? <><Check size={13} className="text-solid" /> Copied!</>
              : <><Copy size={13} strokeWidth={1.75} /> Copy link</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── Valid-upto cell — plain date, muted when expired ─────────────────────────

function ValidUpto({ row }: { row: QuotationRow }) {
  const label = formatDate(row.validUntil);
  if (row.expiryBucket === "expired") {
    return <span className="tabular text-[12.5px] text-fault/70 line-through">{label}</span>;
  }
  return <span className="tabular text-[12.5px] text-text-dim">{label}</span>;
}

// ── Actions cell — three inline icon buttons ──────────────────────────────────

function RowActions({ row }: { row: QuotationRow }) {
  const canEdit = ["DRAFT", "REVISED"].includes(row.status);
  const btnCls =
    "flex items-center justify-center w-7 h-7 rounded-[6px] " +
    "text-text-dim hover:text-text hover:bg-surface-2 transition-colors";

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link
        href={`/quotations/${row.id}` as Route}
        title="View"
        className={btnCls}
        onClick={(e) => e.stopPropagation()}
      >
        <Eye size={14} strokeWidth={1.75} />
      </Link>
      {canEdit ? (
        <Link
          href={`/quotations/${row.id}/edit` as Route}
          title="Edit"
          className={btnCls}
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil size={13} strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={`${btnCls} opacity-25 cursor-default`}>
          <Pencil size={13} strokeWidth={1.75} />
        </span>
      )}
      <MoreMenu row={row} />
    </div>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

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
        <div className="text-[11.5px] text-text-dim mt-0.5 font-data tabular">{r.clientMobile}</div>
      </div>
    ),
  },
  {
    key: "project",
    header: "Project / Design",
    render: (r) => (
      <span className="text-[12.5px] text-text-dim truncate max-w-[200px] block">{r.projectName}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusPill status={r.status} />,
  },
  {
    key: "total",
    header: "Total Value",
    align: "right",
    render: (r) => (
      <span className="tabular font-semibold text-[13.5px] text-text">{formatINR(r.total)}</span>
    ),
  },
  {
    key: "validUntil",
    header: "Valid Upto",
    render: (r) => <ValidUpto row={r} />,
  },
  {
    key: "date",
    header: "Created On",
    cellClassName: "text-text-dim tabular text-[12.5px]",
    render: (r) => formatDate(r.date),
  },
  {
    key: "actions",
    header: "",
    render: (r) => <RowActions row={r} />,
  },
];

// ── Export ────────────────────────────────────────────────────────────────────

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
          body="Try adjusting your filters or create a new quotation."
        />
      }
    />
  );
}
