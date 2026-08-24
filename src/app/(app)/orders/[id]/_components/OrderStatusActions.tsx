"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderStatus } from "@/modules/orders/actions";

const NEXT_STATUS: Record<string, { label: string; next: string }[]> = {
  CONFIRMED:   [{ label: "Start Procurement", next: "PROCUREMENT" }, { label: "Cancel Order", next: "CANCELLED" }],
  PROCUREMENT: [{ label: "Move to Make",      next: "MAKE" },        { label: "Cancel Order", next: "CANCELLED" }],
  MAKE:        [{ label: "Mark Completed",    next: "COMPLETED" },   { label: "Cancel Order", next: "CANCELLED" }],
};

interface Props {
  orderId: string;
  status:  string;
}

export function OrderStatusActions({ orderId, status }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actions = NEXT_STATUS[status];
  if (!actions) return null;

  function apply(next: string) {
    setError(null);
    start(async () => {
      const res = await setOrderStatus({ id: orderId, status: next });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule px-5 py-3.5 flex items-center justify-between gap-4">
      <div className="text-[12.5px] text-text-dim">
        {error
          ? <span className="text-fault">{error}</span>
          : "Advance the order through its workflow stages."
        }
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions.map(({ label, next }) => (
          <button
            key={next}
            onClick={() => apply(next)}
            disabled={pending}
            className={`h-[34px] px-4 rounded-[8px] text-[12.5px] font-medium disabled:opacity-50 transition-colors ${
              next === "CANCELLED"
                ? "border border-fault/40 text-fault hover:bg-fault/5"
                : "bg-accent text-white hover:opacity-90"
            }`}
          >
            {pending ? "Updating…" : label}
          </button>
        ))}
      </div>
    </div>
  );
}
