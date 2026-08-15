"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download, Mail, MessageCircle, Copy, Check,
  ExternalLink, FolderOpen, ArrowUpRight,
} from "lucide-react";
import { StatusPill } from "../../_components/StatusPill";
import { StatusChanger } from "../../_components/StatusChanger";
import type { SerializedQuotation } from "../_types";

// ── formatting helpers (BigInt string → display) ────────────────────────

function pToINR(paise: string): string {
  try {
    const n = BigInt(paise);
    const r = n / 100n;
    const s = r.toString();
    if (s.length <= 3) return `₹${s}`;
    const l3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `₹${rest},${l3}`;
  } catch { return "₹0"; }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function shortNum(n: string): string {
  const p = n.split("/");
  return p.length >= 2 ? p.slice(-1)[0] ?? n : n;
}

function digitsOnly(m: string): string { return m.replace(/\D+/g, ""); }

// ── component ────────────────────────────────────────────────────────────

interface Props {
  quotation: SerializedQuotation;
  canApprove: boolean;
}

export function QuotationHeader({ quotation, canApprove }: Props) {
  const [copied, setCopied] = useState(false);

  const isIntraState = BigInt(quotation.igstStr) === 0n;
  const total   = pToINR(quotation.totalStr);
  const taxable = pToINR(quotation.taxableAmountStr);
  const gstAmt  = isIntraState
    ? `${pToINR(quotation.cgstStr)} + ${pToINR(quotation.sgstStr)}`
    : pToINR(quotation.igstStr);
  const gstLabel = isIntraState ? "CGST + SGST" : "IGST";

  const issuedDate = fmtDate(quotation.date);
  const validDate  = fmtDate(quotation.validUntil);
  const num        = shortNum(quotation.number);

  const link = typeof window !== "undefined"
    ? `${window.location.origin}/quotations/${quotation.id}`
    : `/quotations/${quotation.id}`;

  const msgBody =
    `Namaste ${quotation.clientName},\n\n` +
    `Please find our quotation ${num} at the link below.\n\n` +
    `  Total: ${total}\n` +
    `  Valid until: ${validDate}\n\n` +
    `Link: ${link}\n\n` +
    `Reply to accept or request changes.\n\n` +
    `— Team Mandovara\n+91 89404 30051 · mandovara22@gmail.com`;

  const subject  = `Quotation ${num} · Mandovara`;
  const mailHref = quotation.clientEmail
    ? `mailto:${encodeURIComponent(quotation.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msgBody)}`
    : null;
  const waHref = `https://wa.me/${digitsOnly(quotation.clientMobile)}?text=${encodeURIComponent(msgBody)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  }

  return (
    <div className="rounded-[18px] bg-surface border border-rule mb-6 overflow-hidden">

      {/* ── Row 1: Quotation number · Status · Actions ─────────────── */}
      <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={quotation.status} />
          {quotation.revision > 0 && (
            <span className="tabular text-[12px] text-text-dim bg-surface-2 px-2.5 py-1 rounded-[5px]">
              Rev {quotation.revision}
            </span>
          )}
          <span className="font-data text-[22px] font-semibold text-text tabular">
            {quotation.number}
          </span>
        </div>
        <div className="flex items-start gap-2.5 shrink-0">
          <StatusChanger id={quotation.id} current={quotation.status} canApprove={canApprove} />
          <a
            href={`/api/quotations/${quotation.id}/pdf`}
            download
            className="flex items-center gap-2 h-[30px] px-4 rounded-[6px] text-[12.5px] font-semibold transition-colors shrink-0"
            style={{ background: "oklch(0.72 0.115 85)", color: "#0B1020" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.83 0.105 85)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.72 0.115 85)"; }}
          >
            <Download size={13} strokeWidth={2.2} />
            Download PDF
          </a>
        </div>
      </div>

      {/* ── Row 2: Client info + project ──────────────────────────────── */}
      <div className="px-7 pb-5 border-b border-rule/60">
        <div className="text-[20px] font-semibold text-text leading-snug">
          {quotation.clientName}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13.5px] text-text-dim">
          <span className="tabular">{quotation.clientMobile}</span>
          {quotation.clientEmail && (
            <>
              <span className="opacity-40">·</span>
              <span>{quotation.clientEmail}</span>
            </>
          )}
          {quotation.clientGstin && (
            <>
              <span className="opacity-40">·</span>
              <span className="tabular">{quotation.clientGstin}</span>
            </>
          )}
        </div>
        <Link
          href={`/projects/${quotation.projectId}`}
          className="inline-flex items-center gap-1.5 mt-2 text-[13px] text-text-dim hover:text-accent transition-colors"
        >
          <FolderOpen size={12} strokeWidth={1.75} />
          <span>{quotation.projectName}</span>
          <ArrowUpRight size={11} strokeWidth={2} />
        </Link>
      </div>

      {/* ── Row 3: Key metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-rule/60 border-b border-rule/60">
        <div className="px-7 py-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-2.5">
            Total (incl. GST)
          </div>
          <div className="font-display text-[28px] font-semibold text-text tabular leading-none">
            {total}
          </div>
        </div>
        <div className="px-7 py-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-2.5">
            Taxable amount
          </div>
          <div className="font-data text-[22px] font-semibold text-text-dim tabular leading-none">
            {taxable}
          </div>
        </div>
        <div className="px-7 py-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-2.5">
            {gstLabel}
          </div>
          <div className="font-data text-[22px] font-semibold text-text-dim tabular leading-none">
            {gstAmt}
          </div>
        </div>
      </div>

      {/* ── Row 4: Dates + Send actions ──────────────────────────────── */}
      <div className="px-7 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Dates */}
        <div className="flex items-center gap-5 text-[13px] text-text-dim">
          <span>
            Issued <span className="text-text tabular ml-1">{issuedDate}</span>
          </span>
          <span>
            Valid until <span className="text-text tabular ml-1">{validDate}</span>
          </span>
        </div>

        {/* Send buttons */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {mailHref ? (
            <a
              href={mailHref}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule text-[13px] text-text hover:border-gold hover:text-gold transition-colors"
            >
              <Mail size={14} />
              Email
              <ExternalLink size={11} className="opacity-50" />
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule/50 text-[13px] text-text-faint cursor-not-allowed"
              title="No email address on file for this client"
            >
              <Mail size={14} /> Email
            </span>
          )}

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule text-[13px] text-text hover:border-gold hover:text-gold transition-colors"
          >
            <MessageCircle size={14} />
            WhatsApp
            <ExternalLink size={11} className="opacity-50" />
          </a>

          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule text-[13px] text-text-dim hover:text-text hover:border-gold transition-colors"
          >
            {copied ? <Check size={14} className="text-solid" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
