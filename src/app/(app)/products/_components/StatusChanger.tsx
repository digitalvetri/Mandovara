"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRODUCT_STATUSES } from "@/modules/products/schema";
import { setProductStatus } from "@/modules/products/actions-part2";

const LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", DISCONTINUED: "Discontinued",
};

export function StatusChanger({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value;
    if (to === current) return;
    setError(null);
    startTransition(async () => {
      const res = await setProductStatus({ id, status: to });
      if (!res.ok) { setError(res.error ?? "Could not update status"); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        onChange={onSelect}
        disabled={pending}
        className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
      >
        {PRODUCT_STATUSES.map((s) => (
          <option key={s} value={s}>{LABEL[s]}</option>
        ))}
      </select>
      {error && <div className="text-[11.5px] text-bad">{error}</div>}
    </div>
  );
}
