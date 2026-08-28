// Formatters and label maps for the profile page, split out on
// 2026-08-29 when Edit Profile and Account Settings pushed the page past
// CLAUDE.md §10's 300-line ceiling.

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}
export function fmtDateShort(d: Date) {
  return d.toLocaleDateString("en-IN", {
    month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

// ── Label maps ────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  OWNER:           "Studio Owner",
  DESIGNER:        "Interior Designer",
  SALES:           "Sales Executive",
  MEASURE_EXEC:    "Measurement Exec",
  STORE:           "Store Keeper",
  MAKE_SUPERVISOR: "Make Supervisor",
  ACCOUNTS:        "Accounts",
  HR:              "HR Manager",
};

export const DEPT_LABEL: Record<string, string> = {
  SALES:    "Sales",
  DESIGN:   "Design",
  MEASURE:  "Measurement",
  STORE:    "Store",
  MAKE:     "Make / Stitching",
  INSTALL:  "Installation",
  ACCOUNTS: "Accounts",
  HR:       "HR & Admin",
};

