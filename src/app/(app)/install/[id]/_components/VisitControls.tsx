"use client";

// Header controls for the install detail: start visit, capture
// signature (prompt-based today; 5c-PWA replaces this with a canvas),
// complete visit. Each button is only rendered when the transition
// is legal from the current status.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startVisit, captureVisitSignature, completeVisit,
} from "@/modules/install/actions";
import type { InstallStatus } from "@/modules/install/schema";

interface Props {
  visitId:          string;
  status:           InstallStatus;
  hasSignature:     boolean;
}

export function VisitControls({ visitId, status, hasSignature }: Props) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startT(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? "Action failed"); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === "SCHEDULED" && (
        <Btn tone="accent" onClick={() => run(() => startVisit({ visitId }))} disabled={pending}>
          Start visit
        </Btn>
      )}
      {status === "IN_PROGRESS" && (
        <>
          <Btn
            tone={hasSignature ? "muted" : "accent"}
            onClick={() => run(async () => {
              const key = window.prompt(
                "Signature capture (5c-PWA replaces this with a canvas). Paste a Supabase storage key:",
                `install/${visitId}/sig-${Date.now()}.png`,
              )?.trim();
              if (!key) return { ok: false, error: "Signature key required" };
              return captureVisitSignature({ visitId, signatureKey: key });
            })}
            disabled={pending}
          >
            {hasSignature ? "Re-capture signature" : "Capture signature"}
          </Btn>
          <Btn
            tone="good"
            onClick={() => run(() => completeVisit({ visitId, outcome: "COMPLETED" }))}
            disabled={pending || !hasSignature}
          >
            Complete visit
          </Btn>
          <Btn
            tone="muted"
            onClick={() => run(() => completeVisit({ visitId, outcome: "PARTIAL" }))}
            disabled={pending || !hasSignature}
          >
            Mark partial
          </Btn>
        </>
      )}
      {error && <div className="text-[11.5px] text-bad w-full">{error}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  accent: "bg-accent text-white hover:bg-accent-hover",
  good:   "bg-good/12 text-good hover:bg-good/20",
  muted:  "bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover",
};

function Btn({
  tone, onClick, disabled, children,
}: { tone: keyof typeof TONE; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors disabled:opacity-60 ${TONE[tone]}`}
    >
      {children}
    </button>
  );
}
