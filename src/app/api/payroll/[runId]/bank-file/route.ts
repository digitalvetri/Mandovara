// NEFT bank-file export (Phase 7c) — streams a simple CSV that
// accounts can hand to the bank. Header row + one line per payslip
// with net > 0. Format is intentionally plain (name, account, IFSC,
// amount, reference) — the specific bank's template can wrap this
// later; the numbers are the source of truth.
//
// Guardrails:
//   - Refuses if the payroll run isn't FINALIZED or PAID. You don't
//     disburse a draft.
//   - Skips payslips whose employees have no bank details on file
//     and prints their names as a WARNING at the top of the file so
//     the accounts team can chase.

import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const ctx = await devContext();
  const db = scoped(ctx);

  const run = await db.payrollRun.findUnique({
    where:  { id: runId },
    select: {
      id: true, month: true, year: true, status: true, branchId: true,
      finalizedAt: true, totalPayable: true,
      payslips: {
        orderBy: { employee: { code: "asc" } },
        select: {
          id: true, net: true,
          employee: {
            select: { code: true, name: true, bankAccount: true, ifsc: true },
          },
        },
      },
    },
  });
  if (!run) return notFound();
  if (run.status !== "FINALIZED" && run.status !== "PAID") {
    return new Response(
      `Refused: payroll run is ${run.status}. Finalise it first.\n`,
      { status: 400, headers: { "Content-Type": "text/plain" }},
    );
  }

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: run.branchId }, select: { name: true, invoicePrefix: true },
  });

  // ── Assemble CSV ─────────────────────────────────────────────
  const lines: string[] = [];
  const missing: string[] = [];
  lines.push(
    `# Mandovara Interior OS — NEFT bank file`,
    `# Payroll: ${MONTHS[run.month - 1]} ${run.year}  Branch: ${branch.name}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Total payable (all payslips, incl. no-account): ₹${(Number(run.totalPayable) / 100).toFixed(2)}`,
    ``,
  );
  lines.push([
    "employee_code", "employee_name", "bank_account", "ifsc",
    "amount_inr", "reference",
  ].join(","));

  let disbursed = 0n;
  for (const p of run.payslips) {
    if (p.net <= 0n) continue;
    if (!p.employee.bankAccount || !p.employee.ifsc) {
      missing.push(`${p.employee.code} ${p.employee.name}`);
      continue;
    }
    const amountRupees = (Number(p.net) / 100).toFixed(2);
    const ref = `SAL/${run.year}/${String(run.month).padStart(2, "0")}/${p.employee.code}`;
    lines.push([
      csv(p.employee.code),
      csv(p.employee.name),
      csv(p.employee.bankAccount),
      csv(p.employee.ifsc),
      amountRupees,
      csv(ref),
    ].join(","));
    disbursed += p.net;
  }

  if (missing.length > 0) {
    // Warnings at top too, so accounts sees them at a glance.
    lines.splice(4, 0,
      `# WARNING: ${missing.length} payslip(s) skipped — no bank details on file:`,
      ...missing.map((m) => `#   ${m}`),
    );
  }
  lines.push(
    ``,
    `# Rows disbursed: ${run.payslips.filter((p) => p.employee.bankAccount && p.employee.ifsc && p.net > 0n).length}`,
    `# Total disbursed: ₹${(Number(disbursed) / 100).toFixed(2)}`,
  );

  const filename = `neft-${branch.invoicePrefix.replace(/\//g, "-")}-${MONTHS[run.month - 1]}-${run.year}.csv`;
  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}

// RFC-4180-ish minimal CSV escaping — quote if the field contains a
// comma, a quote, or a newline; double up any embedded quotes.
function csv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
