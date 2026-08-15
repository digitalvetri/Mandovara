"use client";

// Owner-side "Send quotation" strip. Two deep-link buttons — mailto:
// opens the desktop mail client with subject + body + link pre-filled;
// wa.me opens WhatsApp Web or the desktop app with the same body.
//
// This is the deep-link version. Wiring the Meta Cloud API + SMTP for
// automated send lives behind the same buttons in a follow-up — the
// prop shape stays the same.

import { useMemo, useState } from "react";
import { Mail, MessageCircle, Check, Copy, ExternalLink } from "lucide-react";
import { formatINR } from "@/kernel/money/format";

interface SendActionsProps {
  quotationId:      string;
  quotationNumber:  string;
  clientName:       string;
  clientMobile:     string;
  clientEmail:      string | null;
  totalStr:         string;      // BigInt paise as string
  validUntilIso:    string;
  status:           string;
}

export function SendActions({
  quotationId, quotationNumber, clientName, clientMobile, clientEmail,
  totalStr, validUntilIso, status,
}: SendActionsProps) {
  const [copied, setCopied] = useState(false);

  const link  = useMemo(() => buildQuotationLink(quotationId), [quotationId]);
  const total = useMemo(() => formatINR(BigInt(totalStr)), [totalStr]);
  const validUntil = new Date(validUntilIso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  const subject = `Quotation ${shortNumber(quotationNumber)} · Mandovara`;
  const body =
    `Namaste ${clientName},\n\n` +
    `Please find our quotation ${shortNumber(quotationNumber)} attached / at the link below.\n\n` +
    `  Total: ${total}\n` +
    `  Valid until: ${validUntil}\n\n` +
    `Link: ${link}\n\n` +
    `Reply to this message to accept or ask for changes.\n\n` +
    `— Team Mandovara\n` +
    `+91 89404 30051 · mandovara22@gmail.com`;

  const mailtoHref  = clientEmail
    ? `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;
  const waHref = `https://wa.me/${digitsOnly(clientMobile)}?text=${encodeURIComponent(body)}`;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied — user can still copy from the URL bar */
    }
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[13px] text-text-dim font-medium mr-1">
          Send to client
        </div>

        {mailtoHref ? (
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 rounded-[9px] border border-rule px-4 py-2.5 text-[13.5px] text-text hover:border-gold hover:text-gold transition-colors"
          >
            <Mail size={15} />
            Email
            <ExternalLink size={12} className="opacity-60" />
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-2 rounded-[9px] border border-rule/50 px-4 py-2.5 text-[13.5px] text-text-faint cursor-not-allowed"
            title="Client has no email on file"
          >
            <Mail size={15} /> Email
          </span>
        )}

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-[9px] border border-rule px-4 py-2.5 text-[13.5px] text-text hover:border-gold hover:text-gold transition-colors"
        >
          <MessageCircle size={15} />
          WhatsApp
          <ExternalLink size={12} className="opacity-60" />
        </a>

        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-[9px] border border-rule px-4 py-2.5 text-[13.5px] text-text-dim hover:text-text hover:border-gold transition-colors"
        >
          {copied ? <Check size={15} className="text-good" /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy link"}
        </button>

        <div className="ml-auto flex items-center gap-3 text-[13px] text-text-dim">
          <span>
            To: <span className="text-text font-medium">{clientName}</span>
            {clientEmail ? ` · ${clientEmail}` : ""}
            {" · "}<span className="tabular">{clientMobile}</span>
          </span>
        </div>
      </div>

      {status === "DRAFT" && (
        <div className="mt-3 text-[12.5px] text-text-faint">
          Tip: mark the quotation as SENT after you fire the link — the client-side
          view uses that to reset overdue reminders.
        </div>
      )}
    </div>
  );
}

function buildQuotationLink(id: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/quotations/${id}`;
  return `/quotations/${id}`;
}

function shortNumber(n: string): string {
  const parts = n.split("/");
  return parts.length >= 2 ? parts.slice(-1)[0] ?? n : n;
}

/** WhatsApp deep link needs the international number with no leading +
 *  or non-digit characters. Preserves country code from `+91 98...`. */
function digitsOnly(mobile: string): string {
  return mobile.replace(/\D+/g, "");
}
