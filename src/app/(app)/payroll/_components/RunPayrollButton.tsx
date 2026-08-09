"use client";

// Trigger a payroll run for a chosen (branch, month, year). Small
// launcher — the real UX (multi-branch, retro months) will grow
// alongside Phase 7b/c when the ops team actually needs it.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Play } from "lucide-react";
import { runPayroll } from "@/modules/payroll/actions";

interface Props {
  branches: { id: string; name: string }[];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function RunPayrollButton({ branches }: Props) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  // Default to the previous full month — the common ops case is
  // running last month's payroll early in the current month.
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [month, setMonth] = useState<number>(prevMonth);
  const [year, setYear] = useState<number>(prevYear);

  function commit() {
    setError(null);
    startT(async () => {
      const res = await runPayroll({ branchId, month, year });
      if (!res.ok) { setError(res.error ?? "Failed"); return; }
      router.push(`/payroll/${res.data!.payrollRunId}` as Route);
      router.refresh();
    });
  }

  if (branches.length === 0) {
    return <div className="text-[11.5px] text-text-faint">No branches configured.</div>;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
              className="h-[32px] px-2 rounded-[6px] bg-surface border border-rule text-[12px]">
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="h-[32px] px-2 rounded-[6px] bg-surface border border-rule text-[12px]">
        {MONTHS.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
      </select>
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="h-[32px] px-2 rounded-[6px] bg-surface border border-rule text-[12px] tabular">
        {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button
        type="button"
        onClick={commit}
        disabled={pending}
        className="h-[32px] px-3 rounded-[6px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60 flex items-center gap-1.5"
      >
        <Play size={12} /> {pending ? "Running…" : "Run payroll"}
      </button>
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
    </div>
  );
}
