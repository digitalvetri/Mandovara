"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearCheque } from "@/modules/receipts/actions";
import { bounceReceipt } from "@/modules/receipts/actions";

export function ChequeActionButtons({
  receiptId,
  chequeStatus,
}: {
  receiptId:    string;
  chequeStatus: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (chequeStatus !== "PENDING") return null;

  function doAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "Action failed"); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-bad">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => doAction(() => clearCheque({ id: receiptId }))}
        className="h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium bg-good/12 text-good hover:bg-good/20 transition-colors disabled:opacity-60"
      >
        Mark cleared
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => doAction(() => bounceReceipt({ id: receiptId }))}
        className="h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium bg-bad/12 text-bad hover:bg-bad/20 transition-colors disabled:opacity-60"
      >
        Mark bounced
      </button>
    </div>
  );
}
