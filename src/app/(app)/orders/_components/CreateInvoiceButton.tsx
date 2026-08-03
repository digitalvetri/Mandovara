"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createInvoiceFromOrder } from "@/modules/invoices/actions";

export function CreateInvoiceButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await createInvoiceFromOrder({ salesOrderId: orderId });
      if (!res.ok) { setError(res.error ?? "Could not create invoice"); return; }
      router.push(`/invoicing/${res.data!.id}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
      <button
        type="button"
        onClick={commit}
        disabled={pending}
        className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60 transition-colors"
      >
        {pending ? "Creating…" : "Create invoice"}
      </button>
    </div>
  );
}
