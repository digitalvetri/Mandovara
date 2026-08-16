"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  MoreHorizontal, Eye, Pencil, Download, MessageCircle, Copy, Check,
  Flame, AlertTriangle, FolderOpen, Calendar,
} from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { QuotationRow } from "@/modules/quotations/queries";
import { StatusPill } from "./StatusPill";
import { EmptyState } from "@/components/data/DataTable";

function digitsOnly(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.startsWith("91") && d.length === 12 ? d : `91${d}`;
}

// ── Card actions menu ─────────────────────────────────────────────────────────

function CardMenu({ row }: { row: QuotationRow }) {
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

  const canEdit  = ["DRAFT", "REVISED"].includes(row.status);
  const link     = `/quotations/${row.id}`;
  const shortNum = row.number.split("/").slice(-1)[0] ?? row.number;
  const waBody   = encodeURIComponent(`Namaste,\n\nPlease find quotation ${shortNum} at:\n${typeof window !== "undefined" ? window.location.origin : ""}${link}`);
  const waHref   = `https://wa.me/${digitsOnly(row.clientMobile)}?text=${waBody}`;

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
    <div className="relative" ref={ref}>
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
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-[10px] bg-surface border border-rule shadow-xl shadow-ink/40 py-1"
        >
          <Link href={`/quotations/${row.id}` as Route} className={itemCls} onClick={() => setOpen(false)}>
            <Eye size={13} strokeWidth={1.75} /> View
          </Link>
          {canEdit && (
            <Link href={`/quotations/${row.id}/edit` as Route} className={itemCls} onClick={() => setOpen(false)}>
              <Pencil size={13} strokeWidth={1.75} /> Edit
            </Link>
          )}
          <a href={`/api/quotations/${row.id}/pdf`} download className={itemCls} onClick={() => setOpen(false)}>
            <Download size={13} strokeWidth={1.75} /> Download PDF
          </a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={itemCls} onClick={() => setOpen(false)}>
            <MessageCircle size={13} strokeWidth={1.75} /> WhatsApp
          </a>
          <button type="button" onClick={copyLink} className={itemCls}>
            {copied ? <><Check size={13} className="text-solid" /> Copied!</> : <><Copy size={13} strokeWidth={1.75} /> Copy link</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Expiry indicator ──────────────────────────────────────────────────────────

function ExpiryBadge({ row }: { row: QuotationRow }) {
  if (row.expiryBucket === "ok") return null;
  if (row.expiryBucket === "expired") {
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-fault font-medium mt-2 pt-2 border-t border-rule/50">
        <AlertTriangle size={12} strokeWidth={2} />
        Validity expired {formatDate(row.validUntil)}
      </div>
    );
  }
  if (row.expiryBucket === "critical") {
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-fault font-medium mt-2 pt-2 border-t border-rule/50">
        <Flame size={12} strokeWidth={2} />
        Expires {formatDate(row.validUntil)} — urgent
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-heat mt-2 pt-2 border-t border-rule/50">
      <AlertTriangle size={12} strokeWidth={2} />
      Expires soon — {formatDate(row.validUntil)}
    </div>
  );
}

// ── Individual card ───────────────────────────────────────────────────────────

function QuotationCard({ row }: { row: QuotationRow }) {
  const canEdit = ["DRAFT", "REVISED"].includes(row.status);
  const shortNum = row.number.split("/").slice(-1)[0] ?? row.number;
  const waBody   = encodeURIComponent(`Namaste,\n\nPlease find quotation ${shortNum} at:\n${typeof window !== "undefined" ? window.location.origin : ""}/quotations/${row.id}`);
  const waHref   = `https://wa.me/${digitsOnly(row.clientMobile)}?text=${waBody}`;

  return (
    <Link
      href={`/quotations/${row.id}` as Route}
      className="block rounded-[16px] bg-surface border border-rule hover:border-accent/50 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={row.status} />
          <span className="font-data text-[12.5px] tabular text-text-dim">{row.number}</span>
        </div>
        <div onClick={(e) => e.preventDefault()}>
          <CardMenu row={row} />
        </div>
      </div>

      {/* Client + project */}
      <div className="px-5 pb-4 border-b border-rule/60">
        <div className="text-[15px] font-semibold text-text leading-snug">{row.clientName}</div>
        <div className="flex items-center gap-1.5 mt-1 text-[12px] text-text-dim">
          <FolderOpen size={11} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{row.projectName}</span>
        </div>
      </div>

      {/* Amount + dates */}
      <div className="px-5 pt-4 pb-3">
        <div className="font-display text-[26px] font-semibold text-text tabular leading-none mb-3">
          {formatINR(row.total)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-dim">
          <span className="flex items-center gap-1">
            <Calendar size={10} strokeWidth={1.75} />
            <span className="tabular">{formatDate(row.date)}</span>
          </span>
          <span className="opacity-40">·</span>
          <span className="tabular">{row.lineCount} item{row.lineCount !== 1 ? "s" : ""}</span>
          <span className="opacity-40">·</span>
          <span>{row.ownerName}</span>
        </div>

        <ExpiryBadge row={row} />
      </div>

      {/* Action strip */}
      <div
        className="flex items-center gap-2 px-5 py-3 border-t border-rule/60"
        onClick={(e) => e.preventDefault()}
      >
        <Link
          href={`/quotations/${row.id}` as Route}
          className="flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-colors"
        >
          <Eye size={12} strokeWidth={1.75} /> View
        </Link>
        {canEdit && (
          <>
            <span className="text-rule">·</span>
            <Link
              href={`/quotations/${row.id}/edit` as Route}
              className="flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-colors"
            >
              <Pencil size={12} strokeWidth={1.75} /> Edit
            </Link>
          </>
        )}
        <span className="text-rule">·</span>
        <a
          href={`/api/quotations/${row.id}/pdf`}
          download
          className="flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-colors"
        >
          <Download size={12} strokeWidth={1.75} /> PDF
        </a>
        <span className="text-rule">·</span>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-colors"
        >
          <MessageCircle size={12} strokeWidth={1.75} /> WhatsApp
        </a>
      </div>
    </Link>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export function QuotationCardView({ rows }: { rows: QuotationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="No quotations found."
          body="Try adjusting your filters or create a new quotation."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
      {rows.map((row) => (
        <QuotationCard key={row.id} row={row} />
      ))}
    </div>
  );
}
