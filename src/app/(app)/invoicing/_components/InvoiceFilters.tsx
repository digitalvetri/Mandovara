"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "ALL",         label: "All" },
  { key: "OUTSTANDING", label: "Outstanding" },
  ...INVOICE_STATUSES.map((s) => ({
    key: s,
    label: s === "PARTIALLY_PAID" ? "Partial" : s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

export function InvoiceFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  // Defaults to All (owner, 2026-08-29): opening Invoicing on an empty
  // "Outstanding" tab hid the whole list behind a filter nobody chose.
  const currentStatus = params.get("status") ?? "ALL";

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push(s.length > 0 ? `/invoicing?${s}` : "/invoicing");
    });
  }
  function onStatus(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "ALL") next.delete("status");
    else next.set("status", key);
    next.delete("page");
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-1 border border-rule rounded-[8px] bg-surface p-0.5 max-w-full overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => onStatus(tab.key)}
                    className={[
                      "h-[28px] px-3 rounded-[6px] text-[12px] transition-colors",
                      active ? "bg-accent text-white" : "text-text-dim hover:text-text hover:bg-surface-hover",
                    ].join(" ")}>
              {tab.label}
            </button>
          );
        })}
      </div>

    </div>
  );
}
