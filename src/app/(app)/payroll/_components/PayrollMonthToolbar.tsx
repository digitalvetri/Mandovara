"use client";

// Month/Year selector + "Lock Attendance & Process Payroll".
//
// The payroll screen was hardwired to the current month — getPayrollMonthGrid
// was called with new Date(), so there was no way to look at October
// after October ended, or to prepare the next cycle. Both selectors write
// to the URL, so a month is linkable and survives a refresh.
//
// The action button is deliberately two steps. Locking a month's
// attendance is not reversible from this screen, so the modal states
// exactly what is about to happen — how many records get locked, how
// many employees will be paid, and how many are missing a salary
// structure and will therefore be skipped.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import {
  lockAttendanceAndRunPayroll, previewPayrollRun,
} from "@/modules/payroll/actions-lock";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Preview {
  month: number; year: number;
  employeesWithStructure: number;
  employeesTotal: number;
  unlockedRows: number;
  alreadyRun: boolean;
}

export function PayrollMonthToolbar({
  year, month, canProcess,
}: { year: number; month: number; canProcess: boolean }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState<string | null>(null);
  const [pending, start]      = useTransition();

  const years = [year - 2, year - 1, year, year + 1];

  function go(nextYear: number, nextMonth: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("year", String(nextYear));
    sp.set("month", String(nextMonth));
    router.push(`${pathname}?${sp.toString()}` as Route);
  }

  function openConfirm() {
    setError(null); setDone(null);
    start(async () => {
      const r = await previewPayrollRun({ year, month });
      if (!r.ok || !r.data) { setError(r.error ?? "Could not read this month."); return; }
      setPreview(r.data);
    });
  }

  function confirmRun() {
    setError(null);
    start(async () => {
      const r = await lockAttendanceAndRunPayroll({ year, month });
      if (!r.ok) { setError(r.error ?? "Could not process payroll."); setPreview(null); return; }
      setPreview(null);
      setDone(
        `${MONTHS[month - 1]} ${year} processed — ${r.data?.lockedRows ?? 0} attendance records locked, ` +
        `${r.data?.payslipCount ?? 0} payslip${r.data?.payslipCount === 1 ? "" : "s"} created.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => go(year, Number(e.target.value))}
            aria-label="Month"
            className="h-[36px] rounded-[8px] border border-rule bg-surface px-3 text-[13.5px] text-text outline-none focus:border-accent"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => go(Number(e.target.value), month)}
            aria-label="Year"
            className="h-[36px] rounded-[8px] border border-rule bg-surface px-3 text-[13.5px] tabular-nums text-text outline-none focus:border-accent"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {canProcess && (
          <button
            type="button"
            onClick={openConfirm}
            disabled={pending}
            className="inline-flex h-[36px] items-center gap-2 rounded-[8px] bg-gold px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-gold-strong disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Lock Attendance &amp; Process Payroll
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-[8px] border border-heat/40 bg-heat/8 px-4 py-2.5 text-[13px] text-heat" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 rounded-[8px] border border-good/40 bg-good/8 px-4 py-2.5 text-[13px] text-good" role="status">
          {done}
        </p>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
          <div className="w-full max-w-[460px] rounded-[14px] border border-rule bg-surface p-6">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-gold" />
              <h2 className="text-[16px] font-semibold text-text">
                Process {MONTHS[preview.month - 1]} {preview.year}?
              </h2>
            </div>
            <p className="mb-4 text-[13px] text-text-dim">
              This locks the month&apos;s attendance so it can no longer be edited,
              then calculates gross, deductions and net pay for every employee.
            </p>

            <dl className="mb-5 space-y-2 text-[13.5px]">
              <Row k="Attendance records to lock" v={String(preview.unlockedRows)} />
              <Row k="Employees to be paid"       v={String(preview.employeesWithStructure)} />
              {preview.employeesWithStructure < preview.employeesTotal && (
                <Row
                  k="Skipped — no salary structure"
                  v={String(preview.employeesTotal - preview.employeesWithStructure)}
                  tone="warn"
                />
              )}
            </dl>

            {preview.alreadyRun && (
              <p className="mb-4 rounded-[8px] border border-heat/40 bg-heat/8 px-3 py-2 text-[12.5px] text-heat">
                Payroll has already been run for this month. It cannot be run twice.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-[34px] rounded-[6px] border border-rule px-4 text-[13px] text-text-dim hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRun}
                disabled={pending || preview.alreadyRun}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-[6px] bg-gold px-4 text-[13px] font-semibold text-ink hover:bg-gold-strong disabled:opacity-50"
              >
                {pending && <Loader2 size={13} className="animate-spin" />}
                Lock &amp; process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-dim">{k}</dt>
      <dd className={`tabular-nums font-medium ${tone === "warn" ? "text-gold" : "text-text"}`}>{v}</dd>
    </div>
  );
}
