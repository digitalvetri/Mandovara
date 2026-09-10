"use client";

// Header-level "Create invoice" — same server action as the button on
// PaymentsPanel, just given a more visible home on the project detail
// header so it doesn't require scrolling to find. Rules gating it:
//   1. User has invoice.create permission (parent enforces via canCreate).
//   2. Project has at least one confirmed order.
//   3. The job is paid off. The studio bills once the money is in, so the
//      button appears at the end of a job, not the start. The parent hides
//      it until then; the server refuses it regardless (project-gate.ts),
//      and if the server refuses with an override available, "Bill anyway"
//      appears below.
//
// When a gate is closed the button doesn't render at all — it never shows
// itself disabled, because a disabled primary action reads as "something's
// wrong" rather than "not yet".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import { createInvoiceFromOrder } from "@/modules/invoices/actions-part2";

interface Props {
  orderId:   string;
}

export function CreateInvoiceHeaderButton({ orderId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [canBillAnyway, setCanBillAnyway] = useState(false);

  function onClick(billEarly = false): void {
    setError(null);
    start(async () => {
      const res = await createInvoiceFromOrder({ salesOrderId: orderId, billEarly });
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not create invoice");
        setCanBillAnyway(res.errorCode === "PROJECT_NOT_SETTLED" && res.canOverride === true);
        return;
      }
      router.push(`/invoicing/${res.data.id}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => onClick()}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-gold px-4 py-2 text-[12.5px] font-semibold text-ink shadow-sm transition-all hover:bg-gold-strong hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0"
      >
        {pending
          ? <Loader2 size={13} className="animate-spin" />
          : <FileText size={13} strokeWidth={2} />}
        {pending ? "Creating…" : "Create invoice"}
      </button>
      {error && (
        <div className="inline-flex max-w-[280px] items-start gap-1 rounded-[6px] border border-fault/40 bg-fault/5 px-2 py-1 text-[11px] leading-snug text-fault">
          <AlertCircle size={11} className="mt-[2px] shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {canBillAnyway && (
        <button
          type="button"
          onClick={() => onClick(true)}
          disabled={pending}
          className="inline-flex h-7 items-center rounded-[6px] border border-rule bg-surface-2 px-2.5 text-[11.5px] text-text-dim transition-colors hover:border-gold hover:text-text disabled:opacity-60"
        >
          Bill anyway
        </button>
      )}
    </div>
  );
}
