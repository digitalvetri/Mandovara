"use client";

import { useState, useTransition } from "react";
import { advanceMakeJobStatus } from "@/modules/make/actions";
import { MAKE_STATUS_LABELS } from "@/modules/make/schema";
import { ChevronRight } from "lucide-react";

export function AdvanceMakeJobButton({
  jobId,
  nextStatus,
}: {
  jobId: string;
  nextStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdvance() {
    setError(null);
    startTransition(async () => {
      const result = await advanceMakeJobStatus({ makeJobId: jobId });
      if (!result.ok) setError(result.error ?? "Failed");
    });
  }

  return (
    <div>
      <button
        onClick={handleAdvance}
        disabled={pending}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-gold text-ink text-[12px] font-semibold hover:bg-gold-strong transition-colors disabled:opacity-60"
      >
        <ChevronRight size={13} strokeWidth={2} />
        {pending ? "Updating…" : `Move to ${MAKE_STATUS_LABELS[nextStatus] ?? nextStatus}`}
      </button>
      {error && <p className="text-[11px] text-fault mt-1">{error}</p>}
    </div>
  );
}
