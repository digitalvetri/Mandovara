import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { loadPayroll, loadMyPayslips } from "@/modules/payroll/queries";
import { ApproveButton } from "./_components/PayrollActions";
import { MyPayslipsView } from "./_components/MyPayslipsView";
import { MonthHoursGrid } from "./_components/MonthHoursGrid";
import { PayrollMonthToolbar } from "./_components/PayrollMonthToolbar";
import { PayrollRows } from "./_components/PayrollRows";
import { getPayrollMonthGrid } from "@/modules/payroll/month-grid";

export const dynamic = "force-dynamic";

interface SearchParams { year?: string; month?: string }

export default async function PayrollPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  // Employees without payroll.view see their own payslips only.
  if (!ctx.permissions.has("payroll.view")) {
    const data = await loadMyPayslips(ctx);
    return <MyPayslipsView data={data} />;
  }

  // The month grid is the working behind the pay figures — the sheet an
  // owner checks before approving a run (2026-08-27, owner instruction).
  // Month comes from the URL so a cycle is linkable and survives a
  // refresh; defaults to the current one.
  const now   = new Date();
  const year  = clampInt(params.year,  now.getFullYear(), 2000, 2100);
  const month = clampInt(params.month, now.getMonth() + 1, 1, 12);

  const [p, grid] = await Promise.all([
    loadPayroll(ctx, { year, month }),
    getPayrollMonthGrid(ctx, year, month),
  ]);

  return (
    <>
      <Topbar title="Payroll" eyebrow="Salary computed from locked attendance" />

      <PayrollMonthToolbar
        year={year}
        month={month}
        canProcess={ctx.permissions.has("payroll.run") && ctx.permissions.has("attendance.lock")}
      />

      {(p.runLabel || p.awaitingApproval) && (
        <div className="rounded-[12px] bg-surface border border-rule px-5 py-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-text">{p.runLabel}</div>
            {p.runStatus && <div className="mt-0.5 text-[12px] text-text-dim">{p.runStatus}</div>}
          </div>
          {p.awaitingApproval && p.runId && (
            <ApproveButton runId={p.runId} netFormatted={formatINR(p.net)} />
          )}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Gross payroll" value={formatINR(p.gross)} tone="good" />
        <BandCard label="Deductions"    value={formatINR(p.deductions)} tone="bad" />
        <BandCard label="Net payable"   value={formatINR(p.net)} tone="good-strong" />
        <BandCard label="Headcount"     value={String(p.headcount)} tone="accent" />
      </section>

      <div className="mb-4">
        <MonthHoursGrid grid={grid} />
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              <Th>Employee</Th>
              <Th>Dept</Th>
              <Th align="right">Gross</Th>
              <Th align="right">Deductions</Th>
              <Th align="right">Net pay</Th>
            </tr>
          </thead>
          <PayrollRows rows={p.rows} />
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

/** Read a positive integer from a query param, clamped to a sane range. */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}
