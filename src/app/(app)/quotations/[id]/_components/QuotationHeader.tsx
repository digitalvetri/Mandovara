"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Download, Mail, MessageCircle, Copy, Check,
  ExternalLink, ArrowLeft, Calendar,
} from "lucide-react";
import { StatusPill } from "../../_components/StatusPill";
import { StatusChanger } from "../../_components/StatusChanger";
import type { SerializedQuotation } from "../_types";

// ── helpers ────────────────────────────────────────────────────────────────

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

function digitsOnly(m: string): string { return m.replace(/\D+/g, ""); }

function shortNum(n: string): string {
  const p = n.split("/");
  return p.length >= 2 ? (p.slice(-1)[0] ?? n) : n;
}

function effectiveGstRate(cgstStr: string, taxableStr: string): string {
  try {
    const cgst    = Number(BigInt(cgstStr));
    const taxable = Number(BigInt(taxableStr));
    if (taxable === 0) return "0";
    const rate = (cgst / taxable) * 100;
    return Number.isInteger(rate) ? `${rate}` : rate.toFixed(1);
  } catch { return "0"; }
}

// ── avatar ─────────────────────────────────────────────────────────────────

const AVATAR_BG = [
  "#5B6EAE", "#8E6BAE", "#6BAE8E", "#AE8E6B",
  "#AE6B8E", "#6B8EAE", "#AE6B6B", "#6BAE6B",
];

function ClientAvatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  const bg = AVATAR_BG[letter.charCodeAt(0) % AVATAR_BG.length]!;
  return (
    <span
      className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-[22px] font-semibold text-white select-none"
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

// ── component ──────────────────────────────────────────────────────────────

interface Props {
  quotation: SerializedQuotation;
  canApprove: boolean;
}

export function QuotationHeader({ quotation, canApprove }: Props) {
  const [copied, setCopied] = useState(false);

  const isIntraState = BigInt(quotation.igstStr) === 0n;
  const total     = pToINR(quotation.totalStr);
  const taxable   = pToINR(quotation.taxableAmountStr);
  const cgst      = pToINR(quotation.cgstStr);
  const sgst      = pToINR(quotation.sgstStr);
  const igst      = pToINR(quotation.igstStr);
  const validDate = fmtDate(quotation.validUntil);
  const gstRate   = effectiveGstRate(quotation.cgstStr, quotation.taxableAmountStr);
  const num       = shortNum(quotation.number);

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

  const commRow =
    "flex items-center gap-3 w-full px-4 py-3 text-[13px] text-text-dim " +
    "hover:text-text hover:bg-surface-2 transition-colors rounded-[8px] group";

  return (
    <div className="mb-6">

      {/* ── Top bar: back · number · status pill · actions ──────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link
          href={"/quotations" as Route}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-dim hover:text-text transition-colors shrink-0"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Quotations
        </Link>

        <div className="w-px h-4 bg-rule shrink-0" />

        <h1 className="font-data text-[20px] font-semibold text-text tabular leading-none">
          {quotation.number}
        </h1>
        <StatusPill status={quotation.status} />
        {quotation.revision > 0 && (
          <span className="tabular text-[12px] text-text-dim bg-surface border border-rule px-2.5 py-1 rounded-[5px]">
            Rev {quotation.revision}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap shrink-0">
          <StatusChanger id={quotation.id} current={quotation.status} canApprove={canApprove} />
          <a
            href={`/api/quotations/${quotation.id}/pdf`}
            download
            className="inline-flex items-center gap-1.5 h-[30px] px-4 rounded-[6px] text-[12px] font-semibold transition-colors shrink-0"
            style={{ background: "oklch(0.72 0.115 85)", color: "#0B1020" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.83 0.105 85)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "oklch(0.72 0.115 85)"; }}
          >
            <Download size={13} strokeWidth={2.2} />
            Download PDF
          </a>
        </div>
      </div>

      {/* ── Three info cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_200px] gap-4">

        {/* Card 1 — client ───────────────────────────────────────────── */}
        <div className="rounded-[16px] bg-surface border border-rule px-5 py-5 flex items-start gap-4">
          <ClientAvatar name={quotation.clientName} />
          <div className="min-w-0">
            <div className="text-[18px] font-semibold text-text leading-snug truncate">
              {quotation.clientName}
            </div>
            <div className="text-[13px] text-text-dim tabular font-data mt-1">
              {quotation.clientMobile}
            </div>
            {quotation.clientEmail && (
              <div className="text-[12px] text-text-dim mt-0.5 truncate">
                {quotation.clientEmail}
              </div>
            )}
            {quotation.projectName && (
              <Link
                href={`/projects/${quotation.projectId}` as Route}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim hover:text-accent transition-colors mt-2"
              >
                <span className="truncate">{quotation.projectName}</span>
                <ExternalLink size={11} strokeWidth={1.75} className="shrink-0" />
              </Link>
            )}
          </div>
        </div>

        {/* Card 2 — amount breakdown ─────────────────────────────────── */}
        <div className="rounded-[16px] bg-surface border border-rule px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-2">
            Total Amount (incl. GST)
          </div>
          <div className="font-display text-[38px] font-semibold text-text tabular leading-none mb-4">
            {total}
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-text-dim">Before GST</span>
              <span className="tabular text-text">{taxable}</span>
            </div>
            {isIntraState ? (
              <>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-dim">CGST ({gstRate}%)</span>
                  <span className="tabular text-text">{cgst}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-dim">SGST ({gstRate}%)</span>
                  <span className="tabular text-text">{sgst}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-[13px]">
                <span className="text-text-dim">IGST</span>
                <span className="tabular text-text">{igst}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-2 text-[12.5px] text-text-dim">
              <Calendar size={12} strokeWidth={1.75} />
              Valid until {validDate}
            </div>
          </div>
        </div>

        {/* Card 3 — communication actions ─────────────────────────────── */}
        <div className="rounded-[16px] bg-surface border border-rule px-3 py-3 flex flex-col gap-0.5">
          {mailHref ? (
            <a href={mailHref} className={commRow}>
              <Mail size={14} strokeWidth={1.75} />
              <span>Email</span>
              <ExternalLink size={11} className="ml-auto opacity-40 group-hover:opacity-70" />
            </a>
          ) : (
            <span
              className="flex items-center gap-3 w-full px-4 py-3 text-[13px] text-text-dim/40 cursor-not-allowed rounded-[8px]"
              title="No email address on file"
            >
              <Mail size={14} strokeWidth={1.75} />
              <span>Email</span>
            </span>
          )}
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={commRow}>
            <MessageCircle size={14} strokeWidth={1.75} />
            <span>WhatsApp</span>
            <ExternalLink size={11} className="ml-auto opacity-40 group-hover:opacity-70" />
          </a>
          <button type="button" onClick={copyLink} className={commRow}>
            {copied ? (
              <><Check size={14} className="text-solid" /><span>Copied!</span></>
            ) : (
              <><Copy size={14} strokeWidth={1.75} /><span>Copy Link</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
