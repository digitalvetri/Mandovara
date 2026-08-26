"use client";

// Simplified quotation status control (Phase 1 + Phase 2, 2026-08-26).
//
//   DRAFT / REVISED → SENT → (if lead-scoped) → Convert lead to client
//
// Phase 1 collapsed the six-button approval/accept/reject/convert loop
// down to one Send button + one Convert button. Phase 2 wrapped the
// Send action in a channel-picker modal — clicking Send now asks
// "WhatsApp or Email or Copy link?" before the SENT transition fires,
// and after SENT the same modal is reachable as "Share again" so the
// owner can re-share without confusing status buttons cluttering the
// header.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { setQuotationStatus } from "@/modules/quotations/actions-part2";
import { ConvertLeadModal } from "../../leads/_components/ConvertLeadModal";
import { SendChooserModal, type SendChannel } from "../[id]/_components/SendChooserModal";

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
  const [error, setError]                   = useState<string | null>(null);
  const [showChooser, setShowChooser]       = useState(false);
  const [showConvertLead, setShowConvertLead] = useState(false);

  const canSend        = current === "DRAFT" || current === "REVISED";
  const alreadySent    = !["DRAFT", "REVISED"].includes(current);
  const canConvertNow  = current === "SENT" && !!leadId;

  function handleChannelPicked(_channel: SendChannel): void {
    // Deep link has already been fired inside SendChooserModal.
    setShowChooser(false);

    // Re-share on an already-SENT quote: no status change, no Convert prompt.
    if (alreadySent) return;

    setError(null);
    startTransition(async () => {
      const res = await setQuotationStatus({ id, status: "SENT" });
      if (!res.ok) { setError(res.error ?? "Could not mark as sent"); return; }
      if (leadId) setShowConvertLead(true);
      router.refresh();
    });
  }

  function handleConvertSuccess(data: { clientId: string; projectId: string | null }) {
    setShowConvertLead(false);
    startTransition(async () => {
      // Flipping to ACCEPTED triggers the existing side-effects: the
      // quotation.accepted event (milestone + project-stage advance) and
      // the auto createOrderFromQuotation path. The quote was re-linked
      // to the new client + project inside convertLead, so the ACCEPTED
      // transition sees a client-scoped quote.
      const acc = await setQuotationStatus({ id, status: "ACCEPTED" });
      if (!acc.ok) {
        setError(acc.error ?? "Client created, but could not finalise the quotation");
        router.refresh();
        return;
      }
      const target: Route = data.projectId
        ? (`/projects/${data.projectId}` as Route)
        : (`/clients/${data.clientId}` as Route);
      router.push(target);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        {canSend && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowChooser(true)}
            className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 bg-accent text-white hover:bg-accent-hover"
          >
            Send
          </button>
        )}

        {alreadySent && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowChooser(true)}
            className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 border border-rule text-text-dim hover:text-text hover:border-gold"
          >
            Share again
          </button>
        )}

        {canConvertNow && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowConvertLead(true)}
            className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 bg-solid/12 text-solid hover:bg-solid/20"
          >
            Convert lead to client
          </button>
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

      {leadId && (
        <ConvertLeadModal
          leadId={leadId}
          leadName={clientName}
          mobile={clientMobile}
          email={clientEmail}
          open={showConvertLead}
          onClose={() => setShowConvertLead(false)}
          afterConvert={handleConvertSuccess}
        />
      )}
    </div>
  );
}
