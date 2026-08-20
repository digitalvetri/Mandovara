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
import { StatusPill } from "./StatusPill";

// ── Status → left accent strip colour ────────────────────────────────────────
const STATUS_STRIP: Record<string, string> = {
  DRAFT:    "bg-border",
  SENT:     "bg-heat",
  REVISED:  "bg-info",
  ACCEPTED: "bg-solid",
  REJECTED: "bg-fault/40",
  EXPIRED:  "bg-fault/40",
};

// ── Valid-upto cell ───────────────────────────────────────────────────────────
function ValidUpto({ row }: { row: QuotationRow }) {
  const label = formatDate(row.validUntil);
  if (row.expiryBucket === "expired")
    return <span className="tabular text-[12px] text-fault/70 line-through">{label}</span>;
  if (row.expiryBucket === "critical")
    return <span className="tabular text-[12px] text-fault font-medium">{label}</span>;
  if (row.expiryBucket === "soon")
    return <span className="tabular text-[12px] text-heat font-medium">{label}</span>;
  return <span className="tabular text-[12px] text-text-dim">{label}</span>;
}

// ── MoreMenu ──────────────────────────────────────────────────────────────────
function MoreMenu({ row }: { row: QuotationRow }) {
  const [open, setOpen]     = useState(false);
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

  const item = "flex items-center gap-2.5 w-full px-3 py-2 text-[12.5px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors text-left";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="More actions"
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
          <a href={`/api/quotations/${row.id}/pdf`} download className={item} onClick={() => setOpen(false)}>
            <Download size={13} strokeWidth={1.75} /> Download PDF
          </a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
            <MessageCircle size={13} strokeWidth={1.75} /> Send on WhatsApp
          </a>
          <button type="button" onClick={copyLink} className={item}>
            {copied
              ? <><Check size={13} className="text-solid" /> Copied!</>
              : <><Copy size={13} strokeWidth={1.75} /> Copy link</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────
function RowActions({ row }: { row: QuotationRow }) {
  const canEdit = ["DRAFT", "REVISED"].includes(row.status);
  const btn = "flex items-center justify-center w-7 h-7 rounded-[6px] text-text-dim hover:text-text hover:bg-surface-2 transition-colors";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`/quotations/${row.id}` as Route} title="View" className={btn} onClick={(e) => e.stopPropagation()}>
        <Eye size={14} strokeWidth={1.75} />
      </Link>
      {canEdit ? (
        <Link href={`/quotations/${row.id}/edit` as Route} title="Edit" className={btn} onClick={(e) => e.stopPropagation()}>
          <Pencil size={13} strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={`${btn} opacity-25 cursor-default`}><Pencil size={13} strokeWidth={1.75} /></span>
      )}
      <MoreMenu row={row} />
    </div>
  );
}

// ── Single data row ───────────────────────────────────────────────────────────
function Row({ r, i }: { r: QuotationRow; i: number }) {
  const strip = STATUS_STRIP[r.status] ?? "bg-border";
  const shortNum = r.number.split("/").pop() ?? r.number;

  return (
    <tr className={["group relative transition-colors hover:bg-surface-2/60 cursor-pointer", i > 0 ? "border-t border-rule" : ""].join(" ")}>
      {/* accent strip */}
      <td className="p-0 w-[5px]">
        <div className={`h-full w-[5px] min-h-[68px] ${strip}`} />
      </td>

      {/* QT number + date */}
      <td className="px-4 py-4">
        <Link
          href={`/quotations/${r.id}` as Route}
          className="block tabular text-[13px] font-semibold text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {shortNum}
        </Link>
        <div className="tabular text-[11px] text-text-faint mt-0.5">{formatDate(r.date)}</div>
      </td>

      {/* Client */}
      <td className="px-4 py-4">
        <div className="text-[13px] font-medium text-text leading-snug">{r.clientName}</div>
        <div className="tabular text-[11px] text-text-dim mt-0.5">{r.clientMobile}</div>
      </td>

      {/* Project */}
      <td className="px-4 py-4 max-w-[180px] hidden md:table-cell">
        <span className="text-[12.5px] text-text-dim truncate block">{r.projectName}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <StatusPill status={r.status} />
      </td>

      {/* Total */}
      <td className="px-4 py-4 text-right">
        <span className="tabular text-[13px] font-semibold text-text">{formatINR(r.total)}</span>
      </td>

      {/* Valid upto */}
      <td className="px-4 py-4 hidden sm:table-cell">
        <ValidUpto row={r} />
      </td>

      {/* Created */}
      <td className="px-4 py-4 hidden lg:table-cell">
        <span className="tabular text-[12px] text-text-dim">{formatDate(r.date)}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <RowActions row={r} />
      </td>
    </tr>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] font-medium text-text mb-1.5">No quotations found.</div>
        <p className="text-[12px] text-text-dim">Try adjusting your filters or create a new quotation.</p>
      </div>
    );
  }

  const th = "px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim";
  const thr = "px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim";

  return (
    <div className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2 border-b border-rule">
            <th className="w-[5px] p-0" aria-hidden />
            <th className={th}>Quotation No.</th>
            <th className={th}>Client</th>
            <th className={`${th} hidden md:table-cell`}>Project</th>
            <th className={th}>Status</th>
            <th className={thr}>Total Value</th>
            <th className={`${th} hidden sm:table-cell`}>Valid Upto</th>
            <th className={`${th} hidden lg:table-cell`}>Created On</th>
            <th className="px-4 py-3 w-[80px]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <Row key={r.id} r={r} i={i} />)}
        </tbody>
      </table>
    </div>
  );
}

function digitsOnly(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.startsWith("91") && d.length === 12 ? d : `91${d}`;
}
