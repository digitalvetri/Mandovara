"use client";

// Quotation send control.
//
//   DRAFT / REVISED → [Send] → SENT → [Share again]
//
// What it deliberately no longer does (2026-08-27, owner instruction):
// it used to open the Convert-lead-to-client modal the instant a quote
// was marked SENT, and then set the quote to ACCEPTED itself. That made
// "we emailed a quote" and "the client said yes" the same event, and
// turned a lead into a client before anyone had agreed to anything.
//
// Acceptance is now recorded where it actually happens — the client taps
// Accept on the share link, or staff record it on the lead page — and
// conversion is a separate owner-approved act via ConversionApprovalCard.
// This component's whole job is sending.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { sendQuotation } from "@/modules/quotations/actions-share";
import type { SendChannel } from "@/modules/quotations/share-message";
import { SendChooserModal } from "../[id]/_components/SendChooserModal";

interface Props {
  id:              string;
  current:         string;
  leadId:          string | null;
  quotationNumber: string;
  clientName:      string;
  clientMobile:    string;
  clientEmail:     string | null;
  totalStr:        string;
  validUntilIso:   string;
  shareToken:      string | null;
}

export function StatusChanger({
  id, current, leadId,
  quotationNumber, clientName, clientMobile, clientEmail,
  totalStr, validUntilIso, shareToken,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError]         = useState<string | null>(null);
  const [showChooser, setShowChooser] = useState(false);

  const canSend     = current === "DRAFT" || current === "REVISED";
  const alreadySent = !canSend;

  function handleChannelPicked(channel: SendChannel): void {
    // The deep link has already been fired inside SendChooserModal.
    setShowChooser(false);
    setError(null);

    startTransition(async () => {
      const res = await sendQuotation({ id, channel });
      if (!res.ok) { setError(res.error ?? "Could not mark as sent"); return; }

      // A lead-scoped quote belongs to the lead's workflow — send the
      // operator back there, which is where the next decision (did the
      // client accept?) gets recorded.
      if (leadId && canSend) {
        router.push(`/leads/${leadId}` as Route);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowChooser(true)}
          className={
            "h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 " +
            (canSend
              ? "bg-accent text-white hover:bg-accent-hover"
              : "border border-rule text-text-dim hover:text-text hover:border-gold")
          }
        >
          {canSend ? "Send" : "Share again"}
        </button>

        {alreadySent && leadId && (
          <a
            href={`/leads/${leadId}`}
            className="h-[30px] inline-flex items-center px-3 rounded-[6px] text-[11.5px] font-medium border border-rule text-text-dim hover:text-text hover:border-gold transition-colors"
          >
            Back to lead
          </a>
        )}

        {error && <div className="text-[11.5px] text-fault">{error}</div>}
      </div>

      <SendChooserModal
        open={showChooser}
        onClose={() => setShowChooser(false)}
        onSelected={handleChannelPicked}
        quotationId={id}
        quotationNumber={quotationNumber}
        clientName={clientName}
        clientMobile={clientMobile}
        clientEmail={clientEmail}
        totalStr={totalStr}
        validUntilIso={validUntilIso}
        shareToken={shareToken}
      />
    </div>
  );
}
