// The month's attendance, day 1 to 31, before you approve anyone's pay.
//
// Owner instruction 2026-08-27. Payroll already derived days-present
// from attendance; what it never showed was the working. This is the
// sheet an owner scans to sanity-check a run — who was in, who wasn't,
// and where somebody forgot to check out.
//
// Wide by nature (31 columns), so it scrolls inside its own container
// and the employee name column is sticky. The page itself never scrolls
// sideways.

import { formatHours } from "@/modules/payroll/format-hours";
import type { PayrollMonthGrid, DayCell } from "@/modules/payroll/month-grid";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function cellClass(c: DayCell): string {
  if (c.open) return "bg-warn/15 text-warn";           // needs fixing
  if (c.minutes != null) {
    return c.offSite ? "bg-info/12 text-info" : "bg-good/10 text-good";
  }
  if (c.status === "LEAVE" || c.status === "HOLIDAY" || c.status === "WEEK_OFF") {
    return "bg-surface-2 text-text-faint";
  }
  if (c.status === "ABSENT") return "bg-bad/10 text-bad";
  return "text-text-faint";                             // nothing recorded
}

function cellText(c: DayCell): string {
  if (c.open) return "!";
  if (c.minutes != null) return (c.minutes / 60).toFixed(1);
  if (c.status === "ABSENT")   return "A";
  if (c.status === "LEAVE")    return "L";
  if (c.status === "HOLIDAY")  return "H";
  if (c.status === "WEEK_OFF") return "W";
  return "·";
}

export function MonthHoursGrid({ grid }: { grid: PayrollMonthGrid }) {
  if (grid.rows.length === 0) {
    return (
      <div className="rounded-[12px] border border-rule bg-surface py-10 text-center">
        <div className="text-[13px] font-medium text-text">No staff records yet.</div>
        <div className="mt-1 text-[11.5px] text-text-dim">
          Every user needs a linked staff record. Open Admin and run
          &ldquo;Link staff records&rdquo; to create the missing ones.
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[12px] border border-rule bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3.5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Hours worked
          </div>
          <div className="mt-0.5 text-[13px] text-text">
            {MONTHS[grid.month - 1]} {grid.year}
          </div>
        </div>
        <Legend />
      </div>

      {grid.hasOpenDays && (
        <div className="border-b border-rule bg-warn/8 px-5 py-2.5 text-[12px] text-text">
          Some days have a check-in but no check-out (marked
          <span className="mx-1 font-semibold text-warn">!</span>).
          Those hours count as zero until someone closes them — fix them before
          approving this run.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule bg-surface-2">
              <th className="sticky left-0 z-10 bg-surface-2 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Employee
              </th>
              {Array.from({ length: grid.daysInMonth }, (_, i) => (
                <th key={i} className="tabular w-[26px] px-0 py-2 text-center text-[9.5px] font-medium text-text-dim">
                  {i + 1}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Days
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-rule/60 last:border-0">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                  <div className="whitespace-nowrap text-[12.5px] font-medium text-text">{r.name}</div>
                  <div className="tabular text-[10px] text-text-faint">{r.code}</div>
                </td>
                {r.days.map((c) => (
                  <td key={c.day} className="px-0 py-1 text-center">
                    <span
                      title={
                        c.open ? "Checked in, never checked out"
                        : c.minutes != null ? `${formatHours(c.minutes)}${c.offSite ? " · off-site" : ""}`
                        : c.status ?? "No record"
                      }
                      className={`tabular inline-block w-[24px] rounded-[3px] py-1 text-[9.5px] ${cellClass(c)}`}
                    >
                      {cellText(c)}
                    </span>
                  </td>
                ))}
                <td className="tabular whitespace-nowrap px-3 py-2 text-right text-[12px] text-text">
                  {r.presentDays}
                </td>
                <td className="tabular whitespace-nowrap px-3 py-2 text-right text-[12px] font-medium text-text">
                  {formatHours(r.totalMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-text-dim">
      <Key className="bg-good/10 text-good" label="Worked" />
      <Key className="bg-info/12 text-info" label="Off-site" />
      <Key className="bg-warn/15 text-warn" label="Not closed" />
      <Key className="bg-bad/10 text-bad" label="Absent" />
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-[10px] w-[10px] rounded-[2px] ${className}`} />
      {label}
    </span>
  );
}
