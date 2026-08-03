"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { setQuotationStatus } from "@/modules/quotations/actions";
import { createOrderFromQuotation } from "@/modules/orders/actions";

interface Props {
  id: string;
  current: string;
}

// A quotation moves through a limited set of transitions. We enumerate the
// "next legal steps" from each state so the UI can only offer them.
const NEXT: Record<string, { to: string; label: string; tone?: "accent" | "good" | "bad" }[]> = {
  DRAFT:     [{ to: "SENT",     label: "Send",     tone: "accent" }],
  SENT:      [{ to: "VIEWED",   label: "Mark viewed" },
              { to: "ACCEPTED", label: "Accepted", tone: "good" },
              { to: "REJECTED", label: "Rejected", tone: "bad" }],
  VIEWED:    [{ to: "ACCEPTED", label: "Accepted", tone: "good" },
              { to: "REJECTED", label: "Rejected", tone: "bad" }],
  ACCEPTED:  [{ to: "CONVERTED", label: "Convert to order", tone: "good" }],
  REJECTED:  [],
  EXPIRED:   [],
  CONVERTED: [],
};

const TONE_CLS: Record<string, string> = {
  accent: "bg-accent text-white hover:bg-accent-hover",
  good:   "bg-good/12 text-good hover:bg-good/20",
  bad:    "bg-bad/12  text-bad  hover:bg-bad/20",
};

export function StatusChanger({ id, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextSteps = NEXT[current] ?? [];

  function commit(to: string) {
    setError(null);
    startTransition(async () => {
      // CONVERTED is special: it means "mint a sales order from this quote".
      // The order action flips the quotation to CONVERTED atomically, then
      // we navigate the user to the new order.
      if (to === "CONVERTED") {
        const res = await createOrderFromQuotation({ quotationId: id });
        if (!res.ok) { setError(res.error ?? "Could not convert to order"); return; }
        router.push(`/orders/${res.data!.id}` as Route);
        router.refresh();
        return;
      }
      const res = await setQuotationStatus({ id, status: to });
      if (!res.ok) { setError(res.error ?? "Could not update status"); return; }
      router.refresh();
    });
  }

  if (nextSteps.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {nextSteps.map((s) => (
        <button
          key={s.to}
          type="button"
          disabled={pending}
          onClick={() => commit(s.to)}
          className={[
            "h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60",
            s.tone ? TONE_CLS[s.tone] : "bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover",
          ].join(" ")}
        >
          {s.label}
        </button>
      ))}
      {error && <div className="text-[11.5px] text-bad">{error}</div>}
    </div>
  );
}
