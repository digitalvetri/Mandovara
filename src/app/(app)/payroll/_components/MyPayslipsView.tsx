import { formatINR } from "@/kernel/money/format";
import type { MyPayslipRow, MyPayslipsView } from "@/modules/payroll/queries";
import { Topbar } from "@/components/layout/Topbar";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const FALLBACK_BADGE = { label: "Pending", cls: "bg-heat/12 text-heat border-heat/25" };
function statusBadge(status: string): { label: string; cls: string } {
  if (status === "APPROVED") return { label: "Approved", cls: "bg-solid/12 text-solid border-solid/25" };
  if (status === "PAID")     return { label: "Paid",     cls: "bg-info/12 text-info border-info/25"   };
  return FALLBACK_BADGE;
}

function big(s: string | undefined): bigint {
  if (!s) return 0n;
  try { return BigInt(s); } catch { return 0n; }
}

export function MyPayslipsView({ data }: { data: MyPayslipsView }) {
  const { employee, payslips } = data;

  return (
    <>
      <Topbar title="My Payslips" eyebrow="Your salary statements" />

      {/* No employee record linked */}
      {!employee && (
        <div className="rounded-[14px] border border-rule bg-surface px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-text">No employee profile linked</p>
          <p className="mt-1 text-[12.5px] text-text-dim">Contact your HR admin to link your account.</p>
        </div>
      )}

      {/* Employee linked but no payslips yet */}
      {employee && payslips.length === 0 && (
        <div className="rounded-[14px] border border-rule bg-surface px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-text">No payslips yet</p>
          <p className="mt-1 text-[12.5px] text-text-dim">
            Your payslips will appear here once payroll is processed.
          </p>
        </div>
      )}

      {/* Payslip cards */}
      {payslips.length > 0 && (
        <div className="space-y-4">
          {payslips.map((p) => (
            <PayslipCard key={p.id} payslip={p} />
          ))}
        </div>
      )}
    </>
  );
}

function PayslipCard({ payslip: p }: { payslip: MyPayslipRow }) {
  const badge   = statusBadge(p.runStatus);
  const monthYr = `${MONTH_NAMES[p.month - 1]} ${p.year}`;

  const grossBig = big(p.earnings.gross);
  const dedBig   = big(p.deductions.total);

  return (
    <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-rule">
        <span className="text-[13px] font-semibold text-text">{monthYr}</span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="px-5 py-4">

        {/* Net pay */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.13em] text-text-dim mb-1">Net Pay</div>
            <div className="font-display text-[30px] font-semibold text-text tabular-nums leading-none">
              {formatINR(p.netPay)}
            </div>
          </div>
          <div className="text-right text-[12px] text-text-dim space-y-0.5">
            <div>
              <span className="text-text-faint">Present</span>{" "}
              <span className="font-medium text-text tabular-nums">{p.daysPresent}d</span>
            </div>
            {p.lopDays > 0 && (
              <div>
                <span className="text-text-faint">LOP</span>{" "}
                <span className="font-medium text-bad tabular-nums">{p.lopDays}d</span>
              </div>
            )}
            {p.otHours > 0 && (
              <div>
                <span className="text-text-faint">OT</span>{" "}
                <span className="font-medium text-text tabular-nums">{p.otHours}h</span>
              </div>
            )}
          </div>
        </div>

        {/* Earnings / Deductions columns */}
        <div className="grid grid-cols-2 gap-4">

          {/* Earnings */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim mb-2.5">Earnings</div>
            <div className="space-y-1.5">
              <MoneyRow label="Basic"      value={big(p.earnings.basic)}      />
              <MoneyRow label="HRA"        value={big(p.earnings.hra)}        />
              <MoneyRow label="Conveyance" value={big(p.earnings.conveyance)} />
              {big(p.earnings.ot) > 0n && (
                <MoneyRow label="Overtime" value={big(p.earnings.ot)} />
              )}
              {big(p.earnings.incentive) > 0n && (
                <MoneyRow label="Incentive" value={big(p.earnings.incentive)} />
              )}
              {p.reimbursements > 0n && (
                <MoneyRow label="Reimbursements" value={p.reimbursements} />
              )}
              <div className="pt-1.5 border-t border-rule/60">
                <MoneyRow label="Gross" value={grossBig} bold />
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim mb-2.5">Deductions</div>
            <div className="space-y-1.5">
              <MoneyRow label="PF"   value={big(p.deductions.pf)}  negative />
              <MoneyRow label="ESI"  value={big(p.deductions.esi)} negative />
              <MoneyRow label="PT"   value={big(p.deductions.pt)}  negative />
              {big(p.deductions.tds) > 0n && (
                <MoneyRow label="TDS"  value={big(p.deductions.tds)} negative />
              )}
              {big(p.deductions.advance) > 0n && (
                <MoneyRow label="Advance" value={big(p.deductions.advance)} negative />
              )}
              <div className="pt-1.5 border-t border-rule/60">
                <MoneyRow label="Total" value={dedBig} negative bold />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneyRow({ label, value, negative, bold }: {
  label:    string;
  value:    bigint;
  negative?: boolean;
  bold?:    boolean;
}) {
  if (value === 0n) return null;
  const color = bold ? "text-text" : negative ? "text-bad" : "text-text-dim";
  const prefix = negative ? "−" : "";
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[11.5px] ${bold ? "font-semibold text-text" : "text-text-dim"}`}>{label}</span>
      <span className={`tabular-nums text-[12px] ${bold ? "font-semibold" : "font-normal"} ${color}`}>
        {prefix}{formatINR(value)}
      </span>
    </div>
  );
}
