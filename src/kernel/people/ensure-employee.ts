// Every user of this system is a member of staff.
//
// User and Employee are separate tables joined by an optional `userId`,
// and until 2026-08-27 only the seed script ever filled that link in. A
// user created through Admin got no Employee row — so they could not
// check in ("No employee profile is linked to your account"), did not
// appear in payroll, and had no attendance history. The one-shot repair
// endpoint /api/admin/link-employee exists because this had already
// bitten someone.
//
// Owner instruction: "the users and the roles are considered as
// employees in the organization." So the Employee is created with the
// User, in the same transaction, and this helper is the only place that
// decides what a defaulted Employee looks like.
//
// The two tables are NOT merged. Employee carries payroll and HR data
// (salary structure, bank details, date of joining, department) that has
// no business sitting on a login record, and a tailor on the floor may
// be an Employee with no User at all. The fix is the link, not a merge.

import type { TxClient } from "@/kernel/db/transaction";

/** AppRole -> the department that role works in. */
const ROLE_DEPARTMENT: Record<string, string> = {
  OWNER:           "MANAGEMENT",
  DESIGNER:        "DESIGN",
  SALES:           "SALES",
  MEASURE_EXEC:    "MEASURE",
  STORE:           "STORE",
  MAKE_SUPERVISOR: "MAKE",
  INSTALLER:       "INSTALL",
  ACCOUNTS:        "ACCOUNTS",
  HR:              "HR",
};

/** AppRole -> a human designation, shown on payslips and the people list. */
const ROLE_DESIGNATION: Record<string, string> = {
  OWNER:           "Managing Director",
  DESIGNER:        "Interior Designer",
  SALES:           "Sales Executive",
  MEASURE_EXEC:    "Measurement Executive",
  STORE:           "Store Keeper",
  MAKE_SUPERVISOR: "Make Supervisor",
  INSTALLER:       "Installer",
  ACCOUNTS:        "Accounts Executive",
  HR:              "HR Executive",
};

export function departmentForRole(role: string): string {
  return ROLE_DEPARTMENT[role] ?? "GENERAL";
}

export function designationForRole(role: string): string {
  return ROLE_DESIGNATION[role] ?? "Staff";
}

/**
 * Next employee code for an org, as EMP-0001.
 *
 * Deliberately not routed through NumberSequence: that series exists for
 * documents whose numbering must be gap-free for audit (invoices,
 * quotations). An employee code has no such requirement, and borrowing
 * the sequence machinery would mean a new series row per org for no gain.
 */
export async function nextEmployeeCode(tx: TxClient, orgId: string): Promise<string> {
  const last = await tx.employee.findFirst({
    where:   { organizationId: orgId, code: { startsWith: "EMP-" } },
    orderBy: { code: "desc" },
    select:  { code: true },
  });
  const n = last ? (parseInt(last.code.slice(4), 10) || 0) + 1 : 1;
  return `EMP-${String(n).padStart(4, "0")}`;
}

export interface EnsureEmployeeInput {
  orgId:  string;
  userId: string;
  name:   string;
  mobile: string;
  role:   string;
}

/**
 * Create the Employee for a User if one does not already exist.
 *
 * Idempotent on `userId`, which is unique — safe to call from user
 * creation, from a backfill sweep, and from a repair path for older
 * accounts, without ever producing a duplicate.
 */
export async function ensureEmployeeForUser(
  tx:    TxClient,
  input: EnsureEmployeeInput,
): Promise<{ id: string; created: boolean }> {
  const existing = await tx.employee.findUnique({
    where:  { userId: input.userId },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const code = await nextEmployeeCode(tx, input.orgId);
  const emp = await tx.employee.create({
    data: {
      organizationId: input.orgId,
      userId:         input.userId,
      code,
      name:           input.name,
      mobile:         input.mobile,
      designation:    designationForRole(input.role),
      department:     departmentForRole(input.role),
      // Joining today is the honest default for someone being added now.
      // HR corrects it on the employee record; null was not an option —
      // the column is required and payroll reads it.
      doj:            new Date(),
      status:         "ACTIVE",
    },
    select: { id: true },
  });
  return { id: emp.id, created: true };
}
