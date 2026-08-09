"use client";

// Status transition buttons on the make detail page. Mirrors the
// pattern in quotations/_components/StatusChanger — reads the legal
// next moves from modules/make/status.transitionOptions(), tone
// baked into each option, one-click commit.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceMakeJobStatus } from "@/modules/make/actions";
import { transitionOptions } from "@/modules/make/status";
import type { MakeJobStatus } from "@/modules/make/schema";

interface Props {
  jobId:   string;
  current: MakeJobStatus;
}

const TONE_CLS: Record<string, string> = {
  accent: "bg-accent text-white hover:bg-accent-hover",
  good:   "bg-good/12 text-good hover:bg-good/20",
  bad:    "bg-bad/12  text-bad  hover:bg-bad/20",
};

export function StatusAdvancer({ jobId, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const opts = transitionOptions(current);

  function commit(to: MakeJobStatus, needsNote: boolean) {
    setError(null);
    // QC-fail always benefits from a rework note; prompt for it once
    // so we don't need a separate form component just for this case.
    const qcNote = needsNote
      ? window.prompt("Rework reason (visible in audit log):", "")?.trim()
      : undefined;
    if (needsNote && (!qcNote || qcNote.length === 0)) {
      setError("Rework reason required — none supplied.");
      return;
    }
    startTransition(async () => {
      const res = await advanceMakeJobStatus({
        jobId, toStatus: to,
        ...(qcNote != null && qcNote.length > 0 && { qcNote }),
      });
      if (!res.ok) { setError(res.error ?? "Could not advance status"); return; }
      router.refresh();
    });
  }

  if (opts.length === 0) {
    return (
      <div className="text-[11.5px] text-text-faint italic">
        Delivered — no further transitions.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {opts.map((o) => {
        const needsNote = current === "QC" && o.to === "CUTTING";
        return (
          <button
            key={o.to}
            type="button"
            disabled={pending}
            onClick={() => commit(o.to, needsNote)}
            className={`h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 ${TONE_CLS[o.tone]}`}
          >
            {o.label}
          </button>
        );
      })}
      {error && <div className="text-[11.5px] text-bad w-full">{error}</div>}
    </div>
  );
}
