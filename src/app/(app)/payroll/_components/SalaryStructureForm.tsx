"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSalaryStructure } from "@/modules/payroll/actions";

interface Props {
  employeeId: string;
  employeeName: string;
  currentCtc: bigint | null;
}

export function SalaryStructureForm({ employeeId, employeeName, currentCtc }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ctc, setCtc] = useState<string>(
    currentCtc ? String(Number(currentCtc) / 100) : "",
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(iso(new Date()));
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setSalaryStructure({ employeeId, ctc, effectiveFrom });
      if (!res.ok) { setError(res.error ?? "Could not save"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="text-accent hover:underline text-[11.5px]">
        {currentCtc ? "Update" : "Set CTC"}
      </button>
    );
  }

  return (
    <form onSubmit={commit} className="inline-flex flex-col items-end gap-1 min-w-[240px]">
      <div className="text-[10.5px] text-text-dim self-start">Set for {employeeName}</div>
      <div className="flex items-end gap-2">
        <input value={ctc} onChange={(e) => setCtc(e.target.value)}
               inputMode="decimal" placeholder="e.g. 500000 or 5L"
               className="h-[28px] w-[120px] px-2 bg-white/60 border border-rule rounded-[4px] text-[12px] tabular text-right outline-none focus:border-accent" />
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
               className="h-[28px] px-2 bg-white/60 border border-rule rounded-[4px] text-[11.5px] tabular outline-none focus:border-accent" />
      </div>
      {error && <div className="text-[10.5px] text-bad">{error}</div>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(false)}
                className="text-[10.5px] text-text-dim hover:text-text">Cancel</button>
        <button type="submit" disabled={pending}
                className="h-[24px] px-2 rounded-[4px] bg-accent text-white text-[10.5px] font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
