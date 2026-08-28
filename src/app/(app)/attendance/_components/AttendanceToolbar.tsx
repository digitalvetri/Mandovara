"use client";

// Date picker + [Export Attendance].
//
// The page could only ever show today: loadAttendance built its own
// `new Date()` and nothing could reach past it, so a missed punch from
// last Tuesday was invisible and month-end payroll had nothing to check
// against (owner, 2026-08-29).
//
// Day / Month is a real distinction here, not a display toggle: the day
// view is one row per employee, the month export is the sheet payroll is
// reconciled from. Both write to the URL so a date is linkable.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { CalendarDays, Download } from "lucide-react";

export function AttendanceToolbar({ date }: { date: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  function setDate(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("date", next); else sp.delete("date");
    router.push(`${pathname}${sp.toString() ? `?${sp}` : ""}` as Route);
  }

  const month = date.slice(0, 7); // YYYY-MM

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-[8px] border border-rule bg-surface px-3 h-[36px]">
          <CalendarDays size={14} className="text-text-dim" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Attendance date"
            className="bg-transparent text-[13.5px] tabular-nums text-text outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setDate(new Date().toISOString().slice(0, 10))}
          className="h-[36px] rounded-[8px] border border-rule px-3 text-[13px] text-text-dim transition-colors hover:text-text"
        >
          Today
        </button>
      </div>

      <a
        href={`/api/attendance/export?month=${month}`}
        className="inline-flex h-[36px] items-center gap-1.5 rounded-[8px] border border-rule bg-surface px-4 text-[13px] font-medium text-text-dim transition-colors hover:border-gold hover:text-text"
      >
        <Download size={14} />
        Export Attendance
      </a>
    </div>
  );
}
