"use client";

// Per-quotation actions on the lead page — the owner's ask (2026-08-27):
// after building a quotation you land back on the lead, and the lead is
// where you send it and where you record what the client said.
//
// Two states, in workflow order:
//
//   DRAFT / REVISED → [Send on WhatsApp]  (also email / copy link)
//   SENT            → [Client accepted]   (+ Share again)
//
// "Client accepted" is the staff/phone path. The client's own tap on the
// share link reaches the same ACCEPTED status via acceptQuotationByToken.
// Either way, ConversionApprovalCard below only appears once a quote is
// ACCEPTED — the lead does not become a client before that.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Mail, Copy, Check, Loader2, ThumbsUp } from "lucide-react";
import { sendQuotation, recordClientAcceptance } from "@/modules/quotations/actions-share";
import { buildShareMessage, type SendChannel } from "@/modules/quotations/share-message";

interface Props {
  quotationId:     string;
  quotationNumber: string;
  status:          string;
  totalStr:        string;
  validUntilIso:   string;
  shareToken:      string | null;
  leadName:        string;
  mobile:          string;
  email:           string | null;
}

export function LeadQuoteActions({
  quotationId, quotationNumber, status, totalStr, validUntilIso,
  shareToken, leadName, mobile, email,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);

  const canSend  = status === "DRAFT" || status === "REVISED";
  const isSent   = status === "SENT";
  const isClosed = !canSend && !isSent;   // ACCEPTED / REJECTED / EXPIRED

  if (isClosed) return null;

  const msg = buildShareMessage({
    quotationId, quotationNumber, clientName: leadName,
    totalStr, validUntilIso, shareToken,
    origin: typeof window === "undefined" ? null : window.location.origin,
  });

  function fire(channel: SendChannel): void {
    setError(null);
    // The deep link opens FIRST, synchronously inside the click handler.
    // Opening it after awaiting the server action gets blocked as a popup
    // in Safari and on Android WebView.
    if (channel === "whatsapp") {
      window.open(msg.waHref(mobile), "_blank", "noopener,noreferrer");
    } else if (channel === "email") {
      const href = msg.mailHref(email);
      if (!href) { setError("No email on file for this lead."); return; }
      window.location.href = href;
    } else {
      void navigator.clipboard.writeText(msg.link)
        .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); })
        .catch(() => { /* clipboard denied — the other channels still work */ });
    }

    start(async () => {
      const res = await sendQuotation({ id: quotationId, channel, body: msg.body });
      if (!res.ok) { setError(res.error ?? "Could not mark as sent"); return; }
      router.refresh();
    });
  }

  function accept(): void {
    setError(null);
    start(async () => {
      const res = await recordClientAcceptance({ id: quotationId });
      if (!res.ok) { setError(res.error ?? "Could not record the acceptance"); return; }
      setConfirmAccept(false);
      router.refresh();
    });
  }

  return (
    <div className="px-5 pb-3 -mt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => fire("whatsapp")}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-accent/10 border border-accent/25 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/18 disabled:opacity-60 transition-colors"
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} strokeWidth={2} />}
          {canSend ? "Send on WhatsApp" : "Share again"}
        </button>

        <button
          type="button"
          disabled={pending || !email}
          title={email ?? "No email on file for this lead"}
          onClick={() => fire("email")}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule px-2.5 py-1 text-[11px] text-text-dim hover:text-text hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Mail size={11} strokeWidth={2} />
          Email
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => fire("copy_link")}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule px-2.5 py-1 text-[11px] text-text-dim hover:text-text hover:border-gold disabled:opacity-60 transition-colors"
        >
          {copied ? <Check size={11} className="text-good" strokeWidth={2} /> : <Copy size={11} strokeWidth={2} />}
          {copied ? "Copied" : "Copy link"}
        </button>

        {isSent && !confirmAccept && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmAccept(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-good/10 border border-good/25 px-2.5 py-1 text-[11px] font-medium text-good hover:bg-good/18 disabled:opacity-60 transition-colors"
          >
            <ThumbsUp size={11} strokeWidth={2} />
            Client accepted
          </button>
        )}
      </div>

      {isSent && confirmAccept && (
        <div className="mt-2 rounded-[8px] border border-good/30 bg-good/6 px-3 py-2">
          <div className="text-[11.5px] text-text mb-2">
            Record that {leadName} accepted {quotationNumber}? This unlocks converting
            the lead to a client — it does not convert it on its own.
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={accept}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-good px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {pending && <Loader2 size={11} className="animate-spin" />}
              Yes, they accepted
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmAccept(false)}
              className="rounded-[6px] border border-rule px-3 py-1 text-[11px] text-text-dim hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-1.5 text-[11px] text-fault">{error}</div>}
    </div>
  );
}
