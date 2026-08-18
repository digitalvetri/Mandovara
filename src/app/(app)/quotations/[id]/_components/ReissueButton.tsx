"use client";

// Turns an estimate into a firm, measured quotation.
//
// Deliberately always visible on an estimate, disabled with the reason when it
// cannot run — §10: an error names the next action. A hidden button teaches
// nobody that measuring is the missing step.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ruler } from "lucide-react";
import { reissueAsFirmQuotation } from "@/modules/quotations/reissue-actions";

export function ReissueButton({
  quotationId, blockedReason,
}: { quotationId: string; blockedReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blocked = Boolean(blockedReason);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={blocked || pending}
        title={blockedReason ?? "Create a measured quotation from this estimate"}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await reissueAsFirmQuotation({ quotationId });
            if (res.ok && res.data) router.push(`/quotations/${res.data.quotationId}`);
            else setError(res.error ?? "Could not reissue.");
          })
        }
        className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[8px] bg-gold/15 text-gold border border-gold/30 text-[12.5px] font-medium hover:bg-gold/25 transition-colors disabled:opacity-45 disabled:hover:bg-gold/15"
      >
        <Ruler size={14} strokeWidth={1.75} />
        {pending ? "Reissuing…" : "Reissue as firm quotation"}
      </button>
      {(blockedReason || error) && (
        <span className="text-[10.5px] text-text-faint max-w-[300px] text-right leading-snug">
          {error ?? blockedReason}
        </span>
      )}
    </div>
  );
}
