// /payroll/[runId] — a run's payslip breakdown.
//
// Shows each employee's gross / deductions / net + a per-line
// breakup expandable modal (future). For 7a keeps it minimal — one
// dense table + a Finalize button when DRAFT.

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { FinalizeButton } from "../_components/FinalizeButton";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Props { params: Promise<{ runId: string }> }

export default async function PayrollRunDetailPage({ params }: Props) {
  const { runId } = await params;
  const ctx = await devContext();
  const db = scoped(ctx);

  const run = await db.payrollRun.findUnique({
    where: { id: runId },
    select: {
      id: true, month: true, year: true, status: true,
      finalizedAt: true, paidAt: true, totalPayable: true,
      branchId: true,
      payslips: {
        orderBy: { net: "desc" },
        select: {
          id: true, employeeId: true, daysWorked: true, daysLOP: true,
          gross: true, deductions: true, net: true, breakup: true,
          employee: { select: { code: true, name: true, department: true } },
        },
      },
    },
  });
  if (!run) notFound();
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: run.branchId }, select: { name: true },
  });

  const finalized = run.status === "FINALIZED" || run.status === "PAID";

  return (
    <>
      <Topbar
        title={`Payroll · ${MONTHS[run.month - 1]} ${run.year}`}
        eyebrow={`${branch.name} · ${run.payslips.length} payslip${run.payslips.length === 1 ? "" : "s"} · ${run.status}${run.finalizedAt ? ` · Finalized ${formatDate(run.finalizedAt)}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={"/payroll" as Route}
                  className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover">
              ← All runs
            </Link>
            {finalized && (
              <a href={`/api/payroll/${run.id}/bank-file`}
                 className="h-[30px] px-3 rounded-[6px] text-[11.5px] font-medium bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover">
                Download bank file
              </a>
            )}
            {!finalized && <FinalizeButton payrollRunId={run.id} />}
          </div>
        }
      />

      <div className="rounded-[14px] bg-sidebar text-sidebar-text p-6 mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-sidebar-dim">
          Total payable
        </div>
        <div className="font-display text-[30px] font-semibold tabular-nums mt-1">
          {formatINR(run.totalPayable)}
        </div>
      </div>

      <div className="rounded-[14px] bg-surface border border-rule overflow-hidden pb-10">
        {run.payslips.length === 0 ? (
          <div className="py-14 text-center">
            <div className="text-[14px] text-text mb-1">No payslips in this run.</div>
            <div className="text-[11.5px] text-text-dim">
              Every active employee needs a salary structure on file for a payslip to compute.
            </div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Employee</Th>
                <Th align="right">Days worked</Th>
                <Th align="right">LOP</Th>
                <Th align="right">Gross</Th>
                <Th align="right">PF</Th>
                <Th align="right">ESI</Th>
                <Th align="right">PT</Th>
                <Th align="right">Net pay</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {run.payslips.map((p) => {
                const b = p.breakup as Record<string, string>;
                return (
                  <tr key={p.id} className="border-b border-rule/60 last:border-0 hover:bg-bg/40">
                    <Td>
                      <div className="text-text">{p.employee.name}</div>
                      <div className="text-[10.5px] text-text-dim">{p.employee.code}{p.employee.department ? ` · ${p.employee.department}` : ""}</div>
                    </Td>
                    <Td align="right"><span className="tabular text-text-dim">{p.daysWorked.toString()}</span></Td>
                    <Td align="right"><span className={`tabular ${Number(p.daysLOP) > 0 ? "text-heat" : "text-text-faint"}`}>{p.daysLOP.toString()}</span></Td>
                    <Td align="right"><span className="tabular text-text">{formatINR(p.gross)}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{b["PF"] ? formatINR(BigInt(b["PF"])) : "—"}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{b["ESI"] ? formatINR(BigInt(b["ESI"])) : "—"}</span></Td>
                    <Td align="right"><span className="tabular text-text-dim">{b["PT"]  ? formatINR(BigInt(b["PT"]))  : "—"}</span></Td>
                    <Td align="right"><span className="tabular text-text font-medium">{formatINR(p.net)}</span></Td>
                    <Td align="right">
                      <Link href={`/payroll/${run.id}/payslip/${p.id}/print` as Route}
                            className="text-[11px] text-accent hover:underline">
                        Payslip
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} align-top`}>{children}</td>;
}
