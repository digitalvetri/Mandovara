"use client";

// Channel-picker modal that replaces the old always-visible WhatsApp /
// Email / Copy-link strip. The owner clicks one Send button; this
// modal is what asks which pipe to fire the deep link into. Selecting
// a channel fires the link inline and then calls onSelected() so the
// parent can transition the quote to SENT.
//
// It no longer opens the Convert-lead-to-client modal (2026-08-27,
// owner instruction). Sending a quote and converting a lead are
// separate events: the lead becomes a client only once the CLIENT has
// accepted, which is now recorded on the lead page.
//
// The message body itself lives in modules/quotations/share-message so
// the lead page's Send action renders the identical text.

import { useMemo, useState } from "react";
import { X, Mail, MessageCircle, Copy, Check } from "lucide-react";
import { buildShareMessage } from "@/modules/quotations/share-message";

export type { SendChannel } from "@/modules/quotations/share-message";
import type { SendChannel } from "@/modules/quotations/share-message";

interface Props {
  open:            boolean;
  onClose:         () => void;
  onSelected:      (channel: SendChannel) => void;

  quotationId:     string;
  quotationNumber: string;
  clientName:      string;
  clientMobile:    string;
  clientEmail:     string | null;
  totalStr:        string;
  validUntilIso:   string;
  shareToken:      string | null;
}

export function SendChooserModal({
  open, onClose, onSelected,
  quotationId, quotationNumber, clientName, clientMobile, clientEmail,
  totalStr, validUntilIso, shareToken,
}: Props) {
  const [copied, setCopied] = useState(false);

  const msg = useMemo(() => buildShareMessage({
    quotationId, quotationNumber, clientName, totalStr, validUntilIso, shareToken,
    origin: typeof window === "undefined" ? null : window.location.origin,
  }), [quotationId, quotationNumber, clientName, totalStr, validUntilIso, shareToken]);

  const link     = msg.link;
  const mailHref = msg.mailHref(clientEmail);
  const waHref   = msg.waHref(clientMobile);

  if (!open) return null;

  function pickWhatsApp(): void {
    window.open(waHref, "_blank", "noopener,noreferrer");
    onSelected("whatsapp");
  }

  function pickEmail(): void {
    if (!mailHref) return;
    window.location.href = mailHref;
    onSelected("email");
  }

  async function pickCopyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard denied — the deep-link buttons still work */ }
    onSelected("copy_link");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Send quotation to client"
    >
      <div className="w-full max-w-[440px] rounded-[14px] border border-rule bg-surface shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Send quotation</div>
            <div className="text-[13px] font-medium text-text mt-0.5 truncate">
              To {clientName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-full text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-2.5">
          <button
            type="button"
            onClick={pickWhatsApp}
            className="w-full flex items-center gap-3 rounded-[10px] border border-rule bg-surface-2 px-4 py-3.5 text-left hover:border-gold hover:bg-surface transition-colors"
          >
            <MessageCircle size={16} className="text-text" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text">WhatsApp</div>
              <div className="text-[11.5px] text-text-dim tabular truncate">{clientMobile}</div>
            </div>
          </button>

          {clientEmail ? (
            <button
              type="button"
              onClick={pickEmail}
              className="w-full flex items-center gap-3 rounded-[10px] border border-rule bg-surface-2 px-4 py-3.5 text-left hover:border-gold hover:bg-surface transition-colors"
            >
              <Mail size={16} className="text-text" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-text">Email</div>
                <div className="text-[11.5px] text-text-dim truncate">{clientEmail}</div>
              </div>
            </button>
          ) : (
            <div
              className="w-full flex items-center gap-3 rounded-[10px] border border-rule/50 bg-surface-2/50 px-4 py-3.5 opacity-50 cursor-not-allowed"
              title="No email on file for this client"
            >
              <Mail size={16} className="text-text-faint" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-text-faint">Email</div>
                <div className="text-[11.5px] text-text-faint">No email on file</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={pickCopyLink}
            className="w-full flex items-center gap-3 rounded-[10px] border border-rule bg-surface-2 px-4 py-3.5 text-left hover:border-gold hover:bg-surface transition-colors"
          >
            {copied
              ? <Check size={16} className="text-good" strokeWidth={1.75} />
              : <Copy  size={16} className="text-text" strokeWidth={1.75} />}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text">
                {copied ? "Link copied" : "Copy share link"}
              </div>
              <div className="text-[11.5px] text-text-dim truncate">{link}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
