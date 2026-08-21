"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Mail, MessageCircle, Copy, Check,
  ExternalLink, ArrowLeft, CalendarDays, Clock4,
} from "lucide-react";
import { StatusPill } from "../../_components/StatusPill";
import { StatusChanger } from "../../_components/StatusChanger";
import { ReissueButton } from "./ReissueButton";
import type { SerializedQuotation } from "../_types";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { pToINR, fmtDate, digitsOnly, shortNum, effectiveGstRate } from "./quote-header-utils";
import { PdfPreviewModal } from "./PdfPreviewModal";

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
      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold text-white select-none"
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
  reissueBlockedReason?: string;
  canApprove: boolean;
}

export function QuotationHeader({ quotation, canApprove, reissueBlockedReason }: Props) {
  const [copied, setCopied] = useState(false);
  const [link, setLink]     = useState(`/quotations/${quotation.id}`);

  useEffect(() => {
    setLink(`${window.location.origin}/quotations/${quotation.id}`);
  }, [quotation.id]);

  const isIntraState = BigInt(quotation.igstStr) === 0n;
  const total     = pToINR(quotation.totalStr);
  const taxable   = pToINR(quotation.taxableAmountStr);
  const cgst      = pToINR(quotation.cgstStr);
  const sgst      = pToINR(quotation.sgstStr);
  const igst      = pToINR(quotation.igstStr);
  const validDate = fmtDate(quotation.validUntil);
  const quoteDate = fmtDate(quotation.date);
  const gstRate   = effectiveGstRate(quotation.cgstStr, quotation.taxableAmountStr);
  const num       = shortNum(quotation.number);

  const msgBody =
    `Namaste ${quotation.clientName},\n\n` +
    `Please find our quotation ${num} at the link below.\n\n` +
    `  Total: ${total}\n` +
    `  Valid until: ${validDate}\n\n` +
    `${link}\n\n` +
    `Reply to accept or request changes.\n\n` +
    `— Team Mandovara\n+91 89404 30051 · mandovara.com`;

  const subject  = `Quotation ${num} from Mandovara`;
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

  const shareBtn =
    "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium " +
    "text-text-dim border border-rule hover:text-text hover:bg-ink/30 hover:border-rule transition-colors";

  return (
    <div className="mb-5">

      {/* ── Nav bar: back · number · status · actions ──────────────── */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Link
          href={"/quotations" as Route}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-dim hover:text-text transition-colors shrink-0"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Quotations
        </Link>

        <div className="w-px h-4 bg-rule shrink-0" />

        <h1 className="font-data text-[17px] font-semibold text-text tabular leading-none">
          {quotation.number}
        </h1>

        <StatusPill status={quotation.status} />

        {isEstimate(quotation.lines) && (
          <span
            title={ESTIMATE_CAVEAT}
            className="text-[10px] uppercase tracking-[0.12em] px-2 py-[3px] rounded-[5px] bg-heat/10 text-heat border border-heat/20"
          >
            Estimate
          </span>
        )}
        {quotation.revision > 0 && (
          <span className="tabular text-[11px] text-text-dim bg-surface border border-rule px-2 py-0.5 rounded-[5px]">
            Rev {quotation.revision}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap shrink-0">
          <StatusChanger id={quotation.id} current={quotation.status} canApprove={canApprove} />
          {isEstimate(quotation.lines) && quotation.status !== "REVISED" && (
            <ReissueButton quotationId={quotation.id} blockedReason={reissueBlockedReason} />
          )}
          <PdfPreviewModal
            quotationId={quotation.id}
            label={quotation.number}
          />
        </div>
      </div>

      {/* ── Document card ─────────────────────────────────────────── */}
      <div className="rounded-[16px] bg-surface border border-rule overflow-hidden shadow-sm">

        {/* Brand accent stripe — 5px, drawn in on page load */}
        <div className="h-[5px] bg-accent" />

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_292px] gap-6">

            {/* ── LEFT: Billed To ─────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Eyebrow + client */}
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.22em] text-text-dim font-semibold mb-3">
                  Billed To
                </div>
                <div className="flex items-start gap-3.5">
                  <ClientAvatar name={quotation.clientName} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[17px] font-semibold text-text leading-tight truncate">
                      {quotation.clientName}
                    </div>
                    <div className="text-[13px] text-text-dim tabular mt-1">
                      {quotation.clientMobile}
                    </div>
                    {quotation.clientEmail && (
                      <div className="text-[12.5px] text-text-dim mt-0.5 truncate">
                        {quotation.clientEmail}
                      </div>
                    )}
                    {quotation.projectName && (
                      <Link
                        href={`/projects/${quotation.projectId}` as Route}
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent/80 transition-colors mt-2"
                      >
                        <span className="truncate">{quotation.projectName}</span>
                        <ExternalLink size={10} strokeWidth={1.75} className="shrink-0 opacity-70" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Quote dates */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={12} strokeWidth={1.75} className="text-text-dim shrink-0" />
                  <div>
                    <div className="text-[9.5px] uppercase tracking-[0.14em] text-text-dim">Date</div>
                    <div className="text-[12.5px] text-text tabular mt-0.5">{quoteDate}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock4 size={12} strokeWidth={1.75} className="text-text-dim shrink-0" />
                  <div>
                    <div className="text-[9.5px] uppercase tracking-[0.14em] text-text-dim">Valid Until</div>
                    <div className="text-[12.5px] text-text tabular mt-0.5">{validDate}</div>
                  </div>
                </div>
              </div>

              {/* Share actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {mailHref ? (
                  <a href={mailHref} className={shareBtn}>
                    <Mail size={13} strokeWidth={1.75} />
                    Send Email
                  </a>
                ) : (
                  <span className={`${shareBtn} opacity-35 cursor-not-allowed`} title="No email on file">
                    <Mail size={13} strokeWidth={1.75} />
                    Send Email
                  </span>
                )}
                <a href={waHref} target="_blank" rel="noopener noreferrer" className={shareBtn}>
                  <MessageCircle size={13} strokeWidth={1.75} />
                  WhatsApp
                </a>
                <button type="button" onClick={copyLink} className={shareBtn}>
                  {copied
                    ? <><Check size={13} className="text-solid" /> Copied!</>
                    : <><Copy size={13} strokeWidth={1.75} /> Copy Link</>
                  }
                </button>
              </div>
            </div>

            {/* ── RIGHT: Amount box ───────────────────────────────── */}
            <div className="rounded-[12px] bg-accent/6 border border-accent/15 p-5 flex flex-col">

              <div className="text-[9.5px] uppercase tracking-[0.22em] text-accent font-semibold mb-2">
                Total Amount
              </div>

              {/* Grand total */}
              <div className="font-display text-[34px] font-bold text-text tabular leading-none mb-1">
                {total}
              </div>
              <div className="text-[11.5px] text-text-dim mb-4">
                Inclusive of all taxes
              </div>

              {/* GST breakdown */}
              <div className="space-y-2 border-t border-accent/15 pt-4 mt-auto">
                <AmtRow label="Subtotal" value={taxable} />
                {isIntraState ? (
                  <>
                    <AmtRow label={`CGST ${gstRate}%`} value={cgst} />
                    <AmtRow label={`SGST ${gstRate}%`} value={sgst} />
                  </>
                ) : (
                  <AmtRow label="IGST" value={igst} />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function AmtRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-text-dim">{label}</span>
      <span className="text-[13px] tabular text-text font-medium">{value}</span>
    </div>
  );
}
