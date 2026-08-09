import Link from "next/link";
import type { Route } from "next";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { loadPayroll } from "@/modules/payroll/queries";
import { RunPayrollButton } from "./_components/RunPayrollButton";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function PayrollPage() {
  const ctx = await devContext();
  const db = scoped(ctx);
  const [p, branches, runs] = await Promise.all([
    loadPayroll(ctx),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }}),
    db.payrollRun.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
      select: {
        id: true, month: true, year: true, status: true, totalPayable: true,
        branchId: true, finalizedAt: true,
        _count: { select: { payslips: true } },
      },
    }),
  ]);
  // No FK back-relation from PayrollRun to Branch; look up the
  // names separately.
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <>
      <Topbar
        title="Payroll"
        eyebrow="Salary computed from locked attendance"
        actions={<RunPayrollButton branches={branches} />}
      />

      {runs.length > 0 && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Payroll runs
            </div>
            <div className="text-[11px] text-text-dim tabular">{runs.length} latest</div>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <th className="px-3 h-[32px] text-left font-medium">Period</th>
                <th className="px-3 h-[32px] text-left font-medium">Branch</th>
                <th className="px-3 h-[32px] text-right font-medium">Employees</th>
                <th className="px-3 h-[32px] text-right font-medium">Total payable</th>
                <th className="px-3 h-[32px] text-left font-medium">Status</th>
                <th className="px-3 h-[32px] text-left font-medium">Finalised</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-rule/60 last:border-0 hover:bg-bg/40">
                  <td className="px-3 py-2">
                    <Link href={`/payroll/${r.id}` as Route}
                          className="tabular text-accent hover:underline">
                      {MONTHS[r.month - 1]} {r.year}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text">{branchNameById.get(r.branchId) ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular text-text-dim">{r._count.payslips}</td>
                  <td className="px-3 py-2 text-right tabular text-text font-medium">{formatINR(r.totalPayable)}</td>
                  <td className="px-3 py-2 text-[11px] text-text-dim uppercase tracking-[0.06em]">{r.status.toLowerCase()}</td>
                  <td className="px-3 py-2 text-[11px] text-text-dim tabular">
                    {r.finalizedAt ? formatDate(r.finalizedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      <div className="rounded-[14px] bg-sidebar text-sidebar-text p-6 mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-[22px] font-semibold">{p.runLabel}</div>
          <div className="mt-1 text-[12px] text-sidebar-dim">{p.runStatus}</div>
        </div>
        {p.awaitingApproval && (
          <button
            type="button"
            className="h-[38px] px-4 rounded-[8px] bg-accent text-white text-[12.5px] font-medium hover:bg-accent-hover transition-colors"
          >
            Review &amp; Approve Run
          </button>
        )}
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Gross payroll" value={formatINR(p.gross)} tone="good" />
        <BandCard label="Deductions"    value={formatINR(p.deductions)} tone="bad" />
        <BandCard label="Net payable"   value={formatINR(p.net)} tone="good-strong" />
        <BandCard label="Headcount"     value={String(p.headcount)} tone="accent" />
      </section>

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Employee</Th>
              <Th>Dept</Th>
              <Th align="right">Gross</Th>
              <Th align="right">Deductions</Th>
              <Th align="right">Net pay</Th>
              <Th align="right">Payslip</Th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r, i) => (
              <tr key={i} className="border-b border-rule/70 last:border-0 hover:bg-surface-hover transition-colors">
                <Td>{r.employeeName}</Td>
                <Td className="text-text-dim">{r.department ?? "—"}</Td>
                <Td align="right"><span className="tabular text-text">{formatINR(r.gross)}</span></Td>
                <Td align="right"><span className="tabular text-bad">−{formatINR(r.deductions)}</span></Td>
                <Td align="right"><span className="tabular text-text font-medium">{formatINR(r.net)}</span></Td>
                <Td align="right"><a className="text-accent hover:underline text-[11.5px]">Send</a></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BandCard({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "good-strong" | "accent" }) {
  const border = tone === "good" ? "border-l-good"
               : tone === "bad" ? "border-l-bad"
               : tone === "good-strong" ? "border-l-good"
               : "border-l-accent";
  return (
    <div className={`rounded-[14px] bg-surface border border-rule border-l-[3px] ${border} p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      <div className="mt-3 font-display text-[26px] font-semibold text-text tabular-nums leading-none">{value}</div>
    </div>
  );
}
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}
