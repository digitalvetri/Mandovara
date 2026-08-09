"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAutomationRule } from "@/modules/whatsapp/actions";

export function RuleToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function flip() {
    startTransition(async () => {
      await toggleAutomationRule({ id, isActive: !enabled });
      router.refresh();
    });
  }
  return (
    <button type="button" onClick={flip} disabled={pending} aria-pressed={enabled}
            className={`w-[36px] h-[20px] rounded-full transition-colors relative ${enabled ? "bg-good" : "bg-rule"}`}>
      <span className={`absolute top-0.5 h-[16px] w-[16px] bg-white rounded-full transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
