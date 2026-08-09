// Printable payslip document — mirrors the /make/[id]/print pattern.
// The card wraps in a `.light` scope so `text-text` etc. resolve to
// dark-on-white regardless of the app theme. @media print hides the
// surrounding shell + the on-screen print bar.
//
// A base64-PDF via @react-pdf/renderer was considered and deferred;
// the browser's Save-as-PDF from this page gives the same output
// without a runtime dep. When Phase 8 hardens for production, swap
// this route for a server-rendered PDF stream.

import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { PrintButton } from "./_components/PrintButton";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props { params: Promise<{ runId: string; payslipId: string }> }

export default async function PayslipPrintPage({ params }: Props) {
  const { runId, payslipId } = await params;
  const ctx = await devContext();
  const db = scoped(ctx);

  const p = await db.payslip.findUnique({
    where: { id: payslipId },
    select: {
      id: true, employeeId: true, daysWorked: true, daysLOP: true,
      gross: true, deductions: true, net: true, breakup: true,
      payrollRunId: true,
      payrollRun: {
        select: {
          id: true, month: true, year: true, status: true, branchId: true, finalizedAt: true,
        },
      },
      employee: {
        select: {
          code: true, name: true, designation: true, department: true,
          panNumber: true, pfNumber: true, bankAccount: true, ifsc: true,
          joinDate: true, mobile: true,
        },
      },
    },
  });
  if (!p || p.payrollRunId !== runId) notFound();
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: p.payrollRun.branchId }, select: { name: true },
  });

  const breakup = p.breakup as Record<string, string>;
  // Split components by convention: earnings are known named
  // (BASIC/HRA/SPECIAL etc.); the runner writes PF/ESI/PT into the
  // same JSON as deductions. Separate them at render time.
  const DEDUCTION_KEYS = new Set(["PF", "ESI", "PT", "TDS", "PF_EMPLOYER", "ESI_EMPLOYER"]);
  const earnings: [string, bigint][] = [];
  const deductions: [string, bigint][] = [];
  for (const [k, v] of Object.entries(breakup)) {
    const paise = BigInt(v);
    if (paise === 0n) continue;
    if (DEDUCTION_KEYS.has(k)) deductions.push([k, paise]);
    else                        earnings.push([k, paise]);
  }
  // Stable order for the classic Indian payslip look.
  const earningsOrder = ["BASIC", "HRA", "SPECIAL", "CONVEYANCE", "MEDICAL", "OTHER"];
  earnings.sort((a, b) => {
    const ai = earningsOrder.indexOf(a[0]); const bi = earningsOrder.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const deductionsOrder = ["PF", "ESI", "PT", "TDS"];
  deductions.sort((a, b) => {
    const ai = deductionsOrder.indexOf(a[0]); const bi = deductionsOrder.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  return (
    <>
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          aside, [data-print-hide], header.topbar { display: none !important; }
          .print-only-shell { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .payslip-card { border: none !important; }
        }
      `}</style>

      <div className="print-only-shell max-w-[780px] mx-auto py-6">
        <div className="light payslip-card rounded-[8px] border border-rule bg-white text-text p-8 print:p-4">
          {/* Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b border-rule">
            <div>
              <div className="font-display text-[22px] font-semibold tracking-[0.02em]">
                MANDOVARA
              </div>
              <div className="text-[10.5px] text-text-dim mt-0.5">
                32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Payslip</div>
              <div className="text-[14px] font-medium mt-1">{MONTHS[p.payrollRun.month - 1]} {p.payrollRun.year}</div>
              <div className="text-[10px] text-text-dim mt-0.5">{branch.name}</div>
            </div>
          </div>

          {/* Employee block */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-[12px]">
            <MetaRow k="Employee"     v={p.employee.name} />
            <MetaRow k="Code"         v={p.employee.code} />
            <MetaRow k="Designation"  v={p.employee.designation ?? "—"} />
            <MetaRow k="Department"   v={p.employee.department ?? "—"} />
            <MetaRow k="PAN"          v={p.employee.panNumber ?? "—"} />
            <MetaRow k="PF number"    v={p.employee.pfNumber ?? "—"} />
            <MetaRow k="Days worked"  v={p.daysWorked.toString()} />
            <MetaRow k="LOP days"     v={p.daysLOP.toString()} />
          </div>

          {/* Earnings + Deductions two-column */}
          <div className="grid grid-cols-2 gap-6 border-t border-rule pt-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-2">Earnings</div>
              <table className="w-full text-[11.5px]">
                <tbody>
                  {earnings.map(([k, v]) => (
                    <tr key={k} className="border-b border-rule/40 last:border-0">
                      <td className="py-1.5">{k}</td>
                      <td className="py-1.5 text-right tabular">{formatINR(v)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium border-t-2 border-rule">
                    <td className="py-2 uppercase tracking-[0.06em] text-[10px]">Gross</td>
                    <td className="py-2 text-right tabular">{formatINR(p.gross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-text-dim mb-2">Deductions</div>
              <table className="w-full text-[11.5px]">
                <tbody>
                  {deductions.length === 0 && (
                    <tr>
                      <td className="py-1.5 text-text-faint" colSpan={2}>None applied.</td>
                    </tr>
                  )}
                  {deductions.map(([k, v]) => (
                    <tr key={k} className="border-b border-rule/40 last:border-0">
                      <td className="py-1.5">{k}</td>
                      <td className="py-1.5 text-right tabular">{formatINR(v)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium border-t-2 border-rule">
                    <td className="py-2 uppercase tracking-[0.06em] text-[10px]">Total</td>
                    <td className="py-2 text-right tabular">{formatINR(p.deductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net payable strip */}
          <div className="mt-6 rounded-[6px] bg-good/10 border border-good/40 px-5 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Net payable</div>
              {(p.employee.bankAccount || p.employee.ifsc) && (
                <div className="text-[10.5px] text-text-dim tabular mt-0.5">
                  {p.employee.bankAccount ?? "—"} · {p.employee.ifsc ?? "—"}
                </div>
              )}
            </div>
            <div className="font-display text-[24px] font-semibold tabular-nums text-good">
              {formatINR(p.net)}
            </div>
          </div>

          <div className="mt-6 text-[10px] text-text-faint text-center">
            {p.payrollRun.finalizedAt
              ? `Finalized ${formatDate(p.payrollRun.finalizedAt)} · ${p.payrollRun.status}`
              : `${p.payrollRun.status} — draft, not yet disbursed`}
            {" · "}This is a system-generated payslip; no signature required.
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between text-[11.5px]" data-print-hide>
          <a href={`/payroll/${runId}`} className="text-text-dim hover:text-accent">
            ← back to payroll run
          </a>
          <PrintButton />
        </div>
      </div>
    </>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9.5px] uppercase tracking-[0.10em] text-text-dim min-w-[80px]">{k}</span>
      <span className="text-text">{v}</span>
    </div>
  );
}
