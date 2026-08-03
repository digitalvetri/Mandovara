"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { markPunch } from "@/modules/attendance/actions";
import type { EmployeeOption } from "@/modules/attendance/queries";

export function MarkPunchForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id ?? "");
  const [status, setStatus] = useState<"PRESENT" | "LATE" | "ABSENT" | "LEAVE">("PRESENT");
  const [inTime, setInTime] = useState<string>("09:00");
  const [outTime, setOutTime] = useState<string>("");
  const [date, setDate] = useState<string>(iso(new Date()));
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await markPunch({ employeeId, date, status, inTime, outTime });
      if (!res.ok) { setError(res.error ?? "Could not mark punch"); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (employees.length === 0) {
    return (
      <div className="text-[11.5px] text-text-dim">
        Add employees in Admin first before marking attendance.
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 h-[36px] px-3 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover transition-colors">
        <Plus size={13} /> Mark punch
      </button>
    );
  }

  return (
    <form onSubmit={commit} className="w-full sm:w-[600px] rounded-[10px] border border-rule bg-surface p-3 shadow-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <Field label="Employee">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                  className={fieldCls}>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}{emp.designation ? ` · ${emp.designation}` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} tabular`} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as never)} className={fieldCls}>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="LEAVE">Leave</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="In">
            <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} className={`${fieldCls} tabular`} />
          </Field>
          <Field label="Out">
            <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} className={`${fieldCls} tabular`} />
          </Field>
        </div>
      </div>
      {error && <div className="text-[11.5px] text-bad mb-2">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)}
                className="h-[30px] px-3 text-[11.5px] text-text-dim hover:text-text">Cancel</button>
        <button type="submit" disabled={pending}
                className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Save punch"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent";
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">{label}</div>
      {children}
    </label>
  );
}
