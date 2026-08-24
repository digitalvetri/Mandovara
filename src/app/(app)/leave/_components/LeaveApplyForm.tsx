"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyLeave } from "@/modules/hr/actions";

const LEAVE_TYPES = [
  { value: "CASUAL",   label: "Casual" },
  { value: "SICK",     label: "Sick" },
  { value: "EARNED",   label: "Earned" },
  { value: "COMP_OFF", label: "Comp-off" },
  { value: "UNPAID",   label: "Unpaid" },
] as const;

interface Props {
  employees: { id: string; name: string; designation: string }[];
}

export function LeaveApplyForm({ employees }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [employeeId, setEmployee] = useState("");
  const [type, setType]           = useState<typeof LEAVE_TYPES[number]["value"]>("CASUAL");
  const [fromDate, setFrom]       = useState(today);
  const [toDate, setTo]           = useState(today);
  const [reason, setReason]       = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { setError("Select an employee."); return; }
    setError(null); setSuccess(false);
    start(async () => {
      const r = await applyLeave({ employeeId, type, fromDate, toDate, reason: reason || undefined });
      if (!r.ok) { setError(r.error ?? "Could not apply"); return; }
      setSuccess(true);
      setReason(""); setEmployee("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">Employee</div>
        <select
          value={employeeId}
          onChange={(e) => setEmployee(e.target.value)}
          required
          className="h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
        >
          <option value="">— pick —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">Type</div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof LEAVE_TYPES[number]["value"])}
          className="h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">From</div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFrom(e.target.value)}
          required
          className="h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12px] tabular outline-none focus:border-accent"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">To</div>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setTo(e.target.value)}
          required
          className="h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12px] tabular outline-none focus:border-accent"
        />
      </div>

      <div className="flex-1 min-w-[160px]">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">Reason</div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="optional"
          maxLength={500}
          className="w-full h-[32px] px-2 bg-surface-2 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-[32px] px-4 rounded-[6px] bg-accent text-white text-[12px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-60 whitespace-nowrap"
      >
        Apply
      </button>

      {error && <span className="text-[11px] text-bad w-full">{error}</span>}
      {success && <span className="text-[11px] text-good w-full">Leave applied successfully.</span>}
    </form>
  );
}
