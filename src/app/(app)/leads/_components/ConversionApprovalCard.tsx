"use client";

// Two-approval checklist for lead → client conversion (FIXES-01 §5.1).
//
// Renders only when the lead has at least one lead-scoped quotation
// that has been ACCEPTED. Owner ticks the second box explicitly to
// unlock the "Convert to Client" button, which opens the existing
// ConvertLeadModal (billing form) — nothing about that flow changed;
// this component just gates access to it.
//
// The lead stays a lead until the modal's submit fires convertLead(),
// which then relinks these quotations to the new Client + Project.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, UserCheck } from "lucide-react";
import { approveQuotationForConversion } from "@/modules/quotations/actions-lines";
import { ConvertLeadModal } from "./ConvertLeadModal";

export interface LeadScopedQuote {
  id: string;
  number: string;
  status: string;
  total: string;
  ownerConvertApprovedAt: string | null;
}

interface Props {
  leadId:    string;
  leadName:  string;
  mobile:    string;
  email:     string | null;
  quotes:    LeadScopedQuote[];
}

export function ConversionApprovalCard({ leadId, leadName, mobile, email, quotes }: Props) {
  const router = useRouter();
  const [pendingQid, setPendingQid] = useState<string | null>(null);
  const [, start] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter: only quotes where "client accepted" gate has been passed.
  const acceptedQuotes = quotes.filter((q) => q.status === "ACCEPTED");
  if (acceptedQuotes.length === 0) return null;

  const anyOwnerApproved = acceptedQuotes.some((q) => q.ownerConvertApprovedAt !== null);

  function toggleApprove(qid: string, revoke: boolean) {
    setError(null);
    setPendingQid(qid);
    start(async () => {
      const r = await approveQuotationForConversion({ id: qid, revoke });
      if (!r.ok) setError(r.error ?? "Could not update approval");
      else router.refresh();
      setPendingQid(null);
    });
  }

  return (
    <>
      <section className="rounded-[14px] border border-gold/40 bg-gold-tint p-5 mb-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">Ready to convert?</div>
            <div className="mt-1 text-[13px] text-text">
              {leadName} has {acceptedQuotes.length} accepted quotation{acceptedQuotes.length === 1 ? "" : "s"}.
              Both approvals below must be ticked before the lead becomes a client.
            </div>
          </div>
        </div>

        <ul className="space-y-2 mb-4">
          {acceptedQuotes.map((q) => (
            <li key={q.id} className="rounded-[10px] border border-rule bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="tabular text-[12.5px] text-text">{q.number}</span>
                <span className="text-[10.5px] uppercase tracking-[0.1em] text-solid">Client accepted</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px]">
                  {q.ownerConvertApprovedAt ? (
                    <>
                      <CheckCircle2 size={14} className="text-solid" />
                      <span className="text-text">Owner approved</span>
                    </>
                  ) : (
                    <>
                      <Circle size={14} className="text-text-dim" />
                      <span className="text-text-dim">Owner approval pending</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleApprove(q.id, q.ownerConvertApprovedAt !== null)}
                  disabled={pendingQid === q.id}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-rule bg-transparent px-3 py-1 text-[11.5px] text-text hover:border-gold hover:text-gold disabled:opacity-60 transition-colors"
                >
                  {pendingQid === q.id && <Loader2 size={11} className="animate-spin" />}
                  {q.ownerConvertApprovedAt ? "Revoke" : "Approve conversion"}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mb-3 rounded-[6px] border border-fault/40 bg-fault/5 px-3 py-1.5 text-[11.5px] text-fault">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={!anyOwnerApproved}
          title={anyOwnerApproved
            ? "Create Client + Project and re-link the accepted quotations"
            : "Approve at least one accepted quotation above to enable"}
          className="inline-flex items-center gap-2 rounded-[8px] bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <UserCheck size={14} strokeWidth={1.75} />
          Convert to Client
        </button>
        {!anyOwnerApproved && (
          <span className="ml-3 text-[11px] text-text-dim">Missing: owner approval</span>
        )}
      </section>

      <ConvertLeadModal
        leadId={leadId}
        leadName={leadName}
        mobile={mobile}
        email={email}
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
