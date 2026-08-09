"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { finalizePayrollRun } from "@/modules/payroll/actions";

export function FinalizeButton({ payrollRunId }: { payrollRunId: string }) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit() {
    setError(null);
    const ok = window.confirm("Finalize this payroll run? Attendance for this month will be locked.");
    if (!ok) return;
    startT(async () => {
      const res = await finalizePayrollRun({ payrollRunId });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={commit}
        disabled={pending}
        className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-good/12 text-good hover:bg-good/20 disabled:opacity-60 flex items-center gap-1.5"
      >
        <CheckCircle size={12} /> {pending ? "Finalising…" : "Finalise"}
      </button>
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
    </div>
  );
}
