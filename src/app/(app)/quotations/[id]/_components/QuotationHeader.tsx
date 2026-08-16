"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Download, Mail, MessageCircle, Copy, Check,
  ExternalLink, FolderOpen, ArrowLeft, ArrowUpRight,
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

function addPaiseStr(a: string, b: string): string {
  try { return (BigInt(a) + BigInt(b)).toString(); } catch { return "0"; }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function shortNum(n: string): string {
  const p = n.split("/");
  return p.length >= 2 ? (p.slice(-1)[0] ?? n) : n;
}

function digitsOnly(m: string): string { return m.replace(/\D+/g, ""); }

// ── component ──────────────────────────────────────────────────────────────

interface Props {
  quotation: SerializedQuotation;
  canApprove: boolean;
}

export function QuotationHeader({ quotation, canApprove }: Props) {
  const [copied, setCopied] = useState(false);

  const isIntraState = BigInt(quotation.igstStr) === 0n;
  const total    = pToINR(quotation.totalStr);
  const taxable  = pToINR(quotation.taxableAmountStr);
  const cgst     = pToINR(quotation.cgstStr);
  const sgst     = pToINR(quotation.sgstStr);
  const igst     = pToINR(quotation.igstStr);
  const totalGst = isIntraState
    ? pToINR(addPaiseStr(quotation.cgstStr, quotation.sgstStr))
    : igst;

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

  const commBtn =
    "inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule " +
    "text-[13px] text-text-dim hover:text-text hover:border-accent/60 transition-colors";

  return (
    <div className="mb-6">

      {/* ── Row 1: back link (left) + status actions + PDF (right) ──── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <Link
          href={"/quotations" as Route}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-dim hover:text-text transition-colors mt-0.5"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Quotations
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── Row 2: quotation number + status pill (shown ONCE) ──────── */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <h1 className="font-data text-[26px] font-semibold text-text tabular leading-none">
          {quotation.number}
        </h1>
        <StatusPill status={quotation.status} />
        {quotation.revision > 0 && (
          <span className="tabular text-[12px] text-text-dim bg-surface border border-rule px-2.5 py-1 rounded-[5px]">
            Rev {quotation.revision}
          </span>
        )}
      </div>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <div className="rounded-[18px] bg-surface border border-rule overflow-hidden">

        {/* ── Customer + project + dates ─────────────────────────────── */}
        <div className="px-7 py-5 border-b border-rule flex flex-wrap items-start gap-x-8 gap-y-4">
          {/* Customer */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
              Customer
            </div>
            <div className="text-[18px] font-semibold text-text leading-snug">
              {quotation.clientName}
            </div>
            <div className="text-[13px] text-text-dim tabular font-data mt-1">
              {quotation.clientMobile}
            </div>
            {quotation.clientEmail && (
              <div className="text-[12.5px] text-text-dim mt-0.5">{quotation.clientEmail}</div>
            )}
            {quotation.clientGstin && (
              <div className="text-[12px] text-text-dim tabular font-data mt-0.5">
                GSTIN {quotation.clientGstin}
              </div>
            )}
          </div>

          {/* Project */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
              Project
            </div>
            <Link
              href={`/projects/${quotation.projectId}` as Route}
              className="inline-flex items-center gap-1.5 text-[14px] text-text hover:text-accent transition-colors mt-0.5"
            >
              <FolderOpen size={13} strokeWidth={1.75} />
              <span>{quotation.projectName}</span>
              <ArrowUpRight size={12} strokeWidth={2} className="text-text-dim" />
            </Link>
          </div>

          {/* Dates — pushed to the right */}
          <div className="ml-auto flex gap-6 shrink-0">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Issued On
              </div>
              <div className="text-[14px] text-text tabular">{issuedDate}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Valid Until
              </div>
              <div className="text-[14px] text-text tabular font-medium">{validDate}</div>
            </div>
          </div>
        </div>

        {/* ── Total amount — most visually prominent ─────────────────── */}
        <div className="px-7 py-7 border-b border-rule">
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-dim mb-3">
            Total Amount (incl. GST)
          </div>
          <div className="font-display text-[44px] font-semibold text-text tabular leading-none mb-4">
            {total}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <span className="text-text-dim">
              Amount Before GST
              <span className="text-text tabular ml-1.5">{taxable}</span>
            </span>
            {isIntraState ? (
              <>
                <span className="text-text-dim/40 select-none">·</span>
                <span className="text-text-dim">
                  CGST <span className="text-text tabular ml-1">{cgst}</span>
                </span>
                <span className="text-text-dim/40 select-none">·</span>
                <span className="text-text-dim">
                  SGST <span className="text-text tabular ml-1">{sgst}</span>
                </span>
                <span className="text-text-dim/40 select-none">·</span>
                <span className="text-text-dim">
                  Total GST <span className="text-text tabular ml-1">{totalGst}</span>
                </span>
              </>
            ) : (
              <>
                <span className="text-text-dim/40 select-none">·</span>
                <span className="text-text-dim">
                  IGST <span className="text-text tabular ml-1">{igst}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Communication actions — all together ───────────────────── */}
        <div className="px-7 py-4 flex flex-wrap items-center gap-2">
          {mailHref ? (
            <a href={mailHref} className={commBtn}>
              <Mail size={13} strokeWidth={1.75} />
              Email
              <ExternalLink size={11} className="opacity-40" />
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[9px] border border-rule/40 text-[13px] text-text-dim/40 cursor-not-allowed select-none"
              title="No email address on file for this client"
            >
              <Mail size={13} strokeWidth={1.75} /> Email
            </span>
          )}
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={commBtn}>
            <MessageCircle size={13} strokeWidth={1.75} />
            WhatsApp
            <ExternalLink size={11} className="opacity-40" />
          </a>
          <button type="button" onClick={copyLink} className={commBtn}>
            {copied
              ? <><Check size={13} className="text-solid" /> Copied!</>
              : <><Copy size={13} strokeWidth={1.75} /> Copy link</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
