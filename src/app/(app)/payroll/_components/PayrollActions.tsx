"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { approvePayroll, sendPayslip } from "@/modules/payroll/actions";

// ── Approve payroll run ────────────────────────────────────────────────────────

interface ApproveButtonProps {
  runId: string;
  netFormatted: string;
}

export function ApproveButton({ runId, netFormatted }: ApproveButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onClick() {
    if (!confirm(`Approve payroll run?\n\nNet payable: ${netFormatted}\n\nThis will lock the run and prevent further edits.`)) return;
    setError(null);
    start(async () => {
      const res = await approvePayroll({ runId });
      if (!res.ok) { setError(res.error ?? "Approval failed"); return; }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "oklch(0.78 0.145 165)" }}>
        <CheckCircle2 size={14} />
        Approved
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="h-[38px] px-4 rounded-[8px] text-[12.5px] font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-60"
        style={{ background: "var(--color-gold)", color: "var(--color-ink)" }}
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        Review &amp; Approve Run
      </button>
      {error && <div className="text-[11px]" style={{ color: "var(--color-fault)" }}>{error}</div>}
    </div>
  );
}

// ── Send payslip per employee ──────────────────────────────────────────────────

interface SendPayslipButtonProps {
  payslipId:    string;
  employeeName: string;
}

export function SendPayslipButton({ payslipId, employeeName }: SendPayslipButtonProps) {
  const [pending, start] = useTransition();
  const [sent,  setSent]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const res = await sendPayslip({ payslipId });
      if (!res.ok) { setError(res.error ?? "Failed to send"); return; }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <span className="text-[11px] tabular-nums" style={{ color: "oklch(0.78 0.145 165)" }}>
        Sent ✓
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title={`Send payslip to ${employeeName}`}
        className="text-[11.5px] hover:underline disabled:opacity-60 inline-flex items-center gap-1"
        style={{ color: "var(--color-gold)" }}
      >
        {pending && <Loader2 size={11} className="animate-spin" />}
        Send
      </button>
      {error && <div className="text-[10px] max-w-[120px] text-right leading-tight" style={{ color: "var(--color-fault)" }}>{error}</div>}
    </div>
  );
}
