// The teams Mandovara actually has.
//
// Owner, 2026-08-29: "now there are only accounts team, sales team and
// field work team and except these one admin Rohit Vaid". Department was
// a free-text box, which is how the same team ends up recorded as
// "Sales", "sales" and "Sales Team" and stops grouping in payroll and
// attendance exports.
//
// Kept as data, not a database enum: a studio that adds a fourth team
// should not need a migration, and existing records carrying anything
// else still display — the list constrains new entry, it does not
// invalidate history.

export const EMPLOYEE_TEAMS = [
  "Accounts",
  "Sales",
  "Field Work",
] as const;

export type EmployeeTeam = (typeof EMPLOYEE_TEAMS)[number];
