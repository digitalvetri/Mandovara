// Roles & permissions — read side for the admin permission matrix editor.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { PERMISSIONS, ALL_PERMISSION_KEYS } from "@/kernel/rbac/permissions";
import type { RequestContext } from "@/kernel/auth/context";

export interface RoleRow {
  id:          string;
  name:        string;
  description: string | null;
  isOwnerRole: boolean;
  isSystem:    boolean;
  permCount:   number;
}

export interface ModuleGroup {
  module:   string;
  label:    string;
  actions:  string[];
}

export interface PermMatrix {
  roles:   RoleRow[];
  groups:  ModuleGroup[];
  // [roleId][permKey] = true/false
  granted: Record<string, Record<string, boolean>>;
}

const MODULE_LABELS: Record<string, string> = {
  catalog:         "Catalog",
  lead:            "Leads",
  client:          "Clients",
  contact:         "Contacts",
  followup:        "Follow-ups",
  complaint:       "Complaints",
  quotation:       "Quotations",
  order:           "Orders",
  dispatch:        "Dispatch",
  vendor:          "Vendors",
  requisition:     "Requisitions",
  po:              "Purchase Orders",
  grn:             "GRN",
  vendorPayment:   "Vendor Payments",
  inventory:       "Inventory",
  stock:           "Stock",
  batch:           "Batches",
  serial:          "Serials",
  allocation:      "Dye-lot Allocation",
  project:         "Projects",
  sitelog:         "Site Logs",
  measurement:     "Measurements",
  invoice:         "Invoices",
  receipt:         "Receipts",
  advance:         "Advances",
  expense:         "Expenses",
  pettyCash:       "Petty Cash",
  employeeAdvance: "Employee Advances",
  employee:        "Employees",
  attendance:      "Attendance",
  leave:           "Leave",
  payroll:         "Payroll",
  make:            "Make (Stitch & Cut)",
  install:         "Installation",
  whatsapp:        "WhatsApp",
  automation:      "Automation",
  report:          "Reports",
  admin:           "Administration",
};

export async function loadPermMatrix(ctx: RequestContext): Promise<PermMatrix> {
  requirePermission(ctx, "admin.permissions");
  const db = scoped(ctx);

  const roles = await db.role.findMany({
    orderBy: [{ isOwnerRole: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, description: true, isOwnerRole: true, isSystem: true,
      permissions: { select: { key: true } },
    },
  });

  const roleRows: RoleRow[] = roles.map((r) => ({
    id:          r.id,
    name:        r.name,
    description: r.description,
    isOwnerRole: r.isOwnerRole,
    isSystem:    r.isSystem,
    permCount:   r.isOwnerRole ? ALL_PERMISSION_KEYS.length : r.permissions.length,
  }));

  const groups: ModuleGroup[] = Object.entries(PERMISSIONS).map(([mod, actions]) => ({
    module:  mod,
    label:   MODULE_LABELS[mod] ?? mod,
    actions: (actions as readonly string[]).map((a) => `${mod}.${a}`),
  }));

  // Build granted matrix: [roleId][permKey] = boolean
  const granted: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    if (role.isOwnerRole) {
      // Owner has every key
      granted[role.id] = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true]));
    } else {
      const set = new Set(role.permissions.map((p) => p.key));
      granted[role.id] = Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, set.has(k)]));
    }
  }

  return { roles: roleRows, groups, granted };
}
