"use client";

// Batch B (25 Aug 2026) — for jobs where the client agrees without
// wanting a formal firm quotation. Moves the project straight to
// Advance Awaited so the owner can proceed to invoicing / install.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FastForward } from "lucide-react";
import { skipFirmQuote } from "@/modules/projects/actions-flow";

interface Props {
  projectId: string;
}

export function SkipQuoteButton({ projectId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm("Skip the firm quotation and move straight to Advance Awaited? You can still create an invoice later.")) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await skipFirmQuote(projectId);
      if (!res.ok) { setError(res.error ?? "Could not skip quote"); return; }
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim hover:text-accent disabled:opacity-60 transition-colors"
      >
        <FastForward size={11} strokeWidth={1.75} />
        {pending ? "Skipping…" : "Skip firm quote →"}
      </button>
      {error && <span className="text-[11px] text-fault">{error}</span>}
    </div>
  );
}
