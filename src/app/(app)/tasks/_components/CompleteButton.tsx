"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { completeFollowUp } from "../_actions";

export function CompleteButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-solid">
        <CheckCircle2 size={12} strokeWidth={2} />
        Done
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await completeFollowUp(id);
          if (res.ok) setDone(true);
        })
      }
      className="flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[11px] font-semibold border border-solid/30 text-solid hover:bg-solid/10 active:scale-[0.98] transition-all disabled:opacity-50 shrink-0"
    >
      {pending
        ? <Loader2 size={11} strokeWidth={2} className="animate-spin" />
        : <CheckCircle2 size={11} strokeWidth={2} />}
      {pending ? "Saving…" : "Mark Done"}
    </button>
  );
}
