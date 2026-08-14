import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { loadPayroll } from "@/modules/payroll/queries";
import { ApproveButton, SendPayslipButton } from "./_components/PayrollActions";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const ctx = await devContext();
  const p = await loadPayroll(ctx);

  return (
    <>
      <Topbar title="Payroll" eyebrow="Salary computed from locked attendance" />

      <div className="rounded-[14px] bg-sidebar text-sidebar-text p-6 mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-[22px] font-semibold">{p.runLabel}</div>
          <div className="mt-1 text-[12px] text-sidebar-dim">{p.runStatus}</div>
        </div>
        {p.awaitingApproval && p.runId && (
          <ApproveButton runId={p.runId} netFormatted={formatINR(p.net)} />
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
                <Td align="right"><span className="tabular text-text font-medium">{formatINR(r.netPay)}</span></Td>
                <Td align="right">
                  {p.hasRun && !p.awaitingApproval
                    ? <SendPayslipButton payslipId={r.payslipId} employeeName={r.employeeName} />
                    : <span className="text-text-dim text-[11px]">—</span>
                  }
                </Td>
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
