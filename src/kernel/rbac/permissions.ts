// The permission registry. Single source of truth for every `module.action`
// key used across the codebase.
//
// The RolePermission table stores these keys as strings — this registry is
// what the RBAC editor UI (Session 20) validates against, and what
// requirePermission(ctx, key) narrows to at compile time.

export const PERMISSIONS = {
  // ── Catalog ────────────────────────────────────────────────
  catalog: [
    "view", "create", "update", "delete",
    "viewCost", "updateCost",
    "bulkImport", "priceRevise",
    "manageCategory", "manageSpecTemplate",
    "attachDocument",
  ],

  // ── Customer ───────────────────────────────────────────────
  lead:     ["view", "create", "update", "delete", "viewOthers", "assign", "convert", "close"],
  client:   ["view", "create", "update", "delete", "viewOthers", "creditLimit", "blacklist", "viewOutstanding"],
  contact:  ["view", "create", "update", "delete"],
  followup: ["view", "create", "close", "delegate", "rule.create"],
  complaint:["view", "create", "assign", "resolve"],

  // ── Sales ──────────────────────────────────────────────────
  quotation: ["view", "create", "update", "delete", "viewOthers", "send", "approve", "cancel", "revise"],
  order:     ["view", "create", "cancel", "amend", "viewMargin"],
  dispatch:  ["view", "create", "approve"],

  // ── Procurement ────────────────────────────────────────────
  vendor:      ["view", "create", "update", "block", "viewRates"],
  requisition: ["view", "create", "approve"],
  po:          ["view", "create", "approve", "cancel"],
  grn:         ["view", "create", "cancel"],
  vendorPayment: ["view", "create", "cancel"],

  // ── Inventory ──────────────────────────────────────────────
  inventory:  ["view", "adjust", "transfer", "stockTake", "valuationChange", "overrideNegative"],
  batch:      ["view", "create", "update"],
  serial:     ["view", "assign"],

  // ── Projects ───────────────────────────────────────────────
  project:    ["view", "create", "update", "materialIssue", "milestoneBill", "closeSnag", "handover"],
  sitelog:    ["view", "create"],

  // ── Finance ────────────────────────────────────────────────
  invoice:     ["view", "create", "cancel", "viewMargin", "irnRegenerate", "irnCancel"],
  receipt:     ["view", "create", "allocate", "reverse"],
  advance:     ["view", "create", "adjust"],
  expense:     ["view", "create", "approve", "reject"],
  pettyCash:   ["view", "manage"],
  employeeAdvance: ["view", "create", "recover"],

  // ── People ─────────────────────────────────────────────────
  employee:   ["view", "create", "update", "terminate", "viewSalary"],
  attendance: ["view", "punch", "viewOthers", "edit", "lock", "geoFence"],
  leave:      ["view", "apply", "approve", "cancel"],
  payroll:    ["view", "run", "viewOthers", "review", "finalize", "bankFile"],

  // ── Automation & Comms ─────────────────────────────────────
  whatsapp: [
    "view", "template.create", "template.submit", "template.approve",
    "broadcast.send", "reply", "assign",
  ],
  automation: ["view", "rule.create", "rule.edit", "rule.disable"],

  // ── Reports & Admin ────────────────────────────────────────
  report: [
    "view.dashboard", "view.sales", "view.stock", "view.accounts",
    "view.payroll", "view.projects", "export",
  ],
  admin: [
    "settings", "permissions", "users", "branches",
    "backup", "audit.view", "numbering", "integrations",
  ],
} as const satisfies Record<string, readonly string[]>;

// Derived key union — "catalog.view" | "catalog.create" | ... | "admin.integrations".
// Every string in the codebase that uses a permission key is narrowed to this.
type ModuleKey = keyof typeof PERMISSIONS;
type ActionKey<M extends ModuleKey> = (typeof PERMISSIONS)[M][number];

export type PermissionKey = {
  [M in ModuleKey]: `${M & string}.${ActionKey<M> & string}`;
}[ModuleKey];

/** All permission keys as a flat array — used by the RBAC editor and seed. */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = Object.entries(PERMISSIONS)
  .flatMap(([mod, actions]) =>
    (actions as readonly string[]).map((a) => `${mod}.${a}` as PermissionKey),
  );

/** Type guard for validating user input against the registry. */
export function isPermissionKey(x: unknown): x is PermissionKey {
  return typeof x === "string" && (ALL_PERMISSION_KEYS as readonly string[]).includes(x);
}
