"use client";

// Client-side "Attach" — calls pickProductForMeasurementItem then routes
// back to the target measurement round. Server action returns the
// measurementId + projectId so the redirect is authoritative (no need
// to plumb them through the URL).

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowRight, Loader2 } from "lucide-react";
import { pickProductForMeasurementItem } from "@/modules/measurement/actions-item";

interface Props {
  colourwayId:       string;
  measurementItemId: string;
  itemLabel:         string;
}

export function AttachToItemButton({ colourwayId, measurementItemId, itemLabel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const r = await pickProductForMeasurementItem({ measurementItemId, colourwayId });
      if (!r.ok || !r.data) { setError(r.error ?? "Could not attach product"); return; }
      router.push(`/projects/${r.data.projectId}/measurements/${r.data.measurementId}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="group inline-flex items-center justify-center gap-2 w-full h-[48px] px-5 rounded-[10px] bg-gold text-ink font-display text-[15px] font-medium tracking-[-0.005em] hover:bg-gold-strong disabled:opacity-60 transition-colors"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        Attach to “{itemLabel}”
        {!pending && <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />}
      </button>
      {error && (
        <div className="rounded-[6px] border border-fault/40 bg-fault/10 px-3 py-1.5 text-[11.5px] text-fault">
          {error}
        </div>
      )}
    </div>
  );
}
