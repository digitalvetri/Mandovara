"use client";

// The payroll table, with each employee's working one click away.
//
// The table showed gross, deductions and net — three totals with no way
// to see how any of them was reached. The owner asked for "full access
// to view complete breakdown details for each employee's payroll"
// (2026-08-29). Approving a salary you cannot audit is how disputes
// start, and the numbers were already stored on the payslip; nothing
// surfaced them.
//
// Expanding a row shows the earnings components, each statutory
// deduction by name, and the days the figure was computed from — which
// is the first thing anyone questions.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { PayrollRow } from "@/modules/payroll/queries";

export function PayrollRows({ rows }: { rows: PayrollRow[] }) {
  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-text-dim">
            No payroll has been run for this month yet.
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {rows.map((r) => <Row key={r.employeeId} row={r} />)}
    </tbody>
  );
}

function Row({ row: r }: { row: PayrollRow }) {
  const [open, setOpen] = useState(false);
  const b = r.breakdown;

  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer border-b border-rule/70 transition-colors last:border-0 hover:bg-surface-hover"
      >
        <td className="px-4 py-3 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-text-dim">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            {r.employeeName}
          </span>
        </td>
        <td className="px-4 py-3 text-[12.5px] text-text-dim">{r.department ?? "—"}</td>
        <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-text">{formatINR(r.gross)}</td>
        <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-bad">−{formatINR(r.deductions)}</td>
        <td className="px-4 py-3 text-right text-[12.5px] font-medium tabular-nums text-text">{formatINR(r.netPay)}</td>
      </tr>

      {open && (
        <tr className="border-b border-rule/70 bg-surface-2/40">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Block title="Earnings">
                <Line k="Basic"      v={formatINR(b.basic)} />
                <Line k="HRA"        v={formatINR(b.hra)} />
                <Line k="Conveyance" v={formatINR(b.conveyance)} />
                <Line k="Other"      v={formatINR(b.other)} />
                <Line k="Gross"      v={formatINR(r.gross)} strong />
              </Block>

              <Block title="Deductions">
                <Line k="Provident fund"     v={formatINR(b.pf)} />
                <Line k="ESI"                v={formatINR(b.esi)} />
                <Line k="Professional tax"   v={formatINR(b.pt)} />
                <Line k="Total"              v={formatINR(r.deductions)} strong />
              </Block>

              <Block title="Computed from">
                <Line k="Days present" v={String(b.daysPresent)} />
                <Line k="Loss of pay"  v={`${b.lopDays} day${b.lopDays === 1 ? "" : "s"}`} />
                <Line k="Net pay"      v={formatINR(r.netPay)} strong />
              </Block>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{title}</div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12.5px] text-text-dim">{k}</dt>
      <dd className={`text-[12.5px] tabular-nums ${strong ? "font-semibold text-text" : "text-text"}`}>{v}</dd>
    </div>
  );
}
