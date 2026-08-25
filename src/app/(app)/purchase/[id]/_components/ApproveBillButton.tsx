"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveVendorBill } from "@/modules/purchase/vendor-bill-actions";

export function ApproveBillButton({ billId }: { billId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function approve() {
    startTransition(async () => {
      const res = await approveVendorBill({ id: billId });
      if (res.ok) {
        router.refresh();
      } else {
        alert(res.error ?? "Could not approve bill");
      }
    });
  }

  return (
    <button
      onClick={approve}
      disabled={pending}
      className="h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60 transition-colors"
    >
      {pending ? "Approving…" : "Approve"}
    </button>
  );
}
