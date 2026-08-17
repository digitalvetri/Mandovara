"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCommissionPayment } from "@/modules/architects/actions";

export function MarkPaidButton({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit() {
    setError(null);
    const ref = window.prompt("Payment reference (UPI txn / cheque no):", "")?.trim();
    if (!ref || ref.length === 0) { setError("Ref required"); return; }
    startT(async () => {
      const res = await recordCommissionPayment({ commissionId, paymentRef: ref });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={commit}
        className="h-[26px] px-2 rounded-[4px] text-[11px] font-medium bg-good/12 text-good hover:bg-good/20 disabled:opacity-60"
      >
        {pending ? "…" : "Mark paid"}
      </button>
      {error && <div className="mt-1 text-[10px] text-bad">{error}</div>}
    </div>
  );
}
