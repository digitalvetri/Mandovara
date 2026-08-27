"use client";

// The client's own Accept / Request-changes control on the public share
// link (2026-08-27, owner instruction).
//
// Before this existed there was no way for a client to accept anything:
// the studio marked its own quotes ACCEPTED on the client's behalf at
// the moment of sending. This is the surface that makes "the client
// accepted" a real, timestamped event — and only an accepted quotation
// lets the lead become a client.
//
// Written for a stranger on a phone: no jargon, big targets, and one
// clear primary action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import {
  acceptQuotationByToken,
  requestQuotationChangesByToken,
} from "@/modules/quotations/public-actions";

const TEAL   = "#1B8A7E";
const BORDER = "#E5E7EB";

export function QuoteDecision({
  token, status, validUntilIso,
}: { token: string; status: string; validUntilIso: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode]   = useState<"idle" | "confirm" | "changes">("idle");
  const [name, setName]   = useState("");
  const [note, setNote]   = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone]   = useState<"accepted" | "changes" | null>(null);

  const expired = new Date(validUntilIso) < new Date();

  if (status === "ACCEPTED" || done === "accepted") {
    return (
      <div className="rounded-[12px] border p-4 flex items-start gap-3" style={{ borderColor: TEAL, background: "#F0FAF8" }}>
        <CheckCircle2 size={18} strokeWidth={2.2} style={{ color: TEAL }} className="mt-0.5 shrink-0" />
        <div>
          <div className="text-[14px] font-semibold text-[#111827]">Thank you — this quotation is accepted.</div>
          <div className="text-[12.5px] text-[#6B7280] mt-0.5">
            Our team will be in touch to confirm the next steps.
          </div>
        </div>
      </div>
    );
  }

  if (done === "changes") {
    return (
      <div className="rounded-[12px] border p-4" style={{ borderColor: BORDER, background: "#FFFFFF" }}>
        <div className="text-[14px] font-semibold text-[#111827]">Thank you — we&apos;ve noted your request.</div>
        <div className="text-[12.5px] text-[#6B7280] mt-0.5">
          Someone from Mandovara will get back to you with a revised quotation.
        </div>
      </div>
    );
  }

  // Only a SENT quotation is decidable. Anything else (draft, already
  // rejected, expired) is read-only here.
  if (status !== "SENT") return null;

  function accept(): void {
    setError(null);
    start(async () => {
      const res = await acceptQuotationByToken(token, name);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      setDone("accepted");
      router.refresh();
    });
  }

  function submitChanges(): void {
    setError(null);
    start(async () => {
      const res = await requestQuotationChangesByToken(token, note);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      setDone("changes");
      router.refresh();
    });
  }

  return (
    <div className="rounded-[12px] border bg-white p-4" style={{ borderColor: BORDER }}>
      {expired && (
        <div className="mb-3 rounded-[8px] bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
          This quotation was valid until {new Date(validUntilIso).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
          })}. You can still accept it — we&apos;ll confirm the prices are unchanged.
        </div>
      )}

      {mode === "idle" && (
        <>
          <div className="text-[13.5px] font-semibold text-[#111827] mb-0.5">Happy with this quotation?</div>
          <div className="text-[12.5px] text-[#6B7280] mb-3">
            Accept it here, or tell us what you&apos;d like changed.
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setMode("confirm")}
              className="flex-1 h-12 rounded-[10px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: TEAL }}
            >
              Accept this quotation
            </button>
            <button
              type="button"
              onClick={() => setMode("changes")}
              className="flex-1 h-12 rounded-[10px] border text-[13.5px] text-[#6B7280] hover:text-[#111827] transition-colors inline-flex items-center justify-center gap-2"
              style={{ borderColor: BORDER }}
            >
              <MessageSquare size={14} strokeWidth={1.9} />
              Request changes
            </button>
          </div>
        </>
      )}

      {mode === "confirm" && (
        <>
          <div className="text-[13.5px] font-semibold text-[#111827] mb-2">Just your name, so we know who accepted</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            autoFocus
            className="w-full h-12 rounded-[10px] border px-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
            style={{ borderColor: BORDER }}
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              onClick={accept}
              className="flex-1 h-12 rounded-[10px] text-[14px] font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: TEAL }}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Confirm acceptance
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="h-12 px-4 rounded-[10px] border text-[13.5px] text-[#6B7280]"
              style={{ borderColor: BORDER }}
            >
              Back
            </button>
          </div>
        </>
      )}

      {mode === "changes" && (
        <>
          <div className="text-[13.5px] font-semibold text-[#111827] mb-2">What would you like changed?</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="e.g. a lighter grey for the living room curtains, and please quote the study separately"
            className="w-full rounded-[10px] border px-3 py-2.5 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none resize-none"
            style={{ borderColor: BORDER }}
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              onClick={submitChanges}
              className="flex-1 h-12 rounded-[10px] text-[14px] font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: TEAL }}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Send to Mandovara
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("idle")}
              className="h-12 px-4 rounded-[10px] border text-[13.5px] text-[#6B7280]"
              style={{ borderColor: BORDER }}
            >
              Back
            </button>
          </div>
        </>
      )}

      {error && <div className="mt-2 text-[12.5px] text-[#B91C1C]">{error}</div>}
    </div>
  );
}
