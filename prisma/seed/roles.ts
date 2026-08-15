// Role + RolePermission seed.
// Creates one dynamic Role row per AppRole, seeds the permission matrix from
// CLAUDE.md §3.1, then backfills User.roleId to point at the matching Role.

import { PrismaClient } from "@prisma/client";

type RoleKey = "OWNER" | "DESIGNER" | "SALES" | "MEASURE_EXEC" | "STORE" | "MAKE_SUPERVISOR" | "INSTALLER" | "ACCOUNTS" | "HR";

const ROLE_META: Record<RoleKey, { name: string; description: string; isOwnerRole?: boolean }> = {
  OWNER:           { name: "Owner",             description: "Full access — Managing Director", isOwnerRole: true },
  DESIGNER:        { name: "Designer",           description: "Catalog, projects, measurements and quotations" },
  SALES:           { name: "Sales",              description: "Leads, clients and quotations" },
  MEASURE_EXEC:    { name: "Measure Executive",  description: "Site measurements and site visits" },
  STORE:           { name: "Store",              description: "Stock, dye-lot allocation and GRN" },
  MAKE_SUPERVISOR: { name: "Make Supervisor",    description: "Make jobs and cut lists" },
  INSTALLER:       { name: "Installer",          description: "Install visits and site logs" },
  ACCOUNTS:        { name: "Accounts",           description: "Invoicing, receipts and payroll view" },
  HR:              { name: "HR",                 description: "Employees, attendance, leave and payroll" },
};

// Explicit denies for the Owner (segregation-of-duties carveouts).
// isOwnerRole=true grants every permission by default; scope=NONE rows
// on this list are removed from that default set inside session.ts.
// Spec (docs/BUILD-SPEC.md project-detail §5): the person who records a
// dimension is not the person who approves it. The Owner approves and
// views measurements; the measurement team creates and edits them.
const OWNER_DENIES: readonly string[] = [
  "measurement.create.any", "measurement.create.own",
  "measurement.edit.any",   "measurement.edit.own",
  "measurement.submit.any", "measurement.submit.own",
  // Legacy keys — same intent, kept in lock-step during scoped-key migration.
  "measurement.create", "measurement.update", "measurement.submit",
];

// Permission keys per role — based on CLAUDE.md §3.1 route access matrix.
// OWNER gets no explicit rows; isOwnerRole=true triggers allPermissions() in session.ts.
const ROLE_PERMISSIONS: Record<Exclude<RoleKey, "OWNER">, string[]> = {
  DESIGNER: [
    "catalog.view", "catalog.viewCost", "catalog.manageCategory", "catalog.attachDocument",
    "lead.view", "lead.create", "lead.update", "lead.viewOthers", "lead.assign", "lead.convert",
    "client.view", "client.create", "client.update", "client.viewOthers", "client.viewOutstanding",
    "contact.view", "contact.create", "contact.update",
    "followup.view", "followup.create", "followup.close",
    "complaint.view", "complaint.create",
    "quotation.view", "quotation.create", "quotation.update", "quotation.revise", "quotation.send", "quotation.viewOthers",
    "order.view", "order.viewMargin",
    "project.view", "project.create", "project.update", "project.materialIssue",
    // Measurement: FULL create · OWN edit · FULL submit · NONE approve · FULL view
    "measurement.view", "measurement.create", "measurement.update", "measurement.submit", "measurement.revise",
    "measurement.view.any", "measurement.create.any", "measurement.edit.own", "measurement.submit.any",
    "sitelog.view", "sitelog.create",
    "make.view", "make.printCutList",
    "install.view",
    "invoice.view",
    "receipt.view",
    "report.view.dashboard", "report.view.projects",
  ],

  SALES: [
    "catalog.view",
    "lead.view", "lead.create", "lead.update", "lead.viewOthers", "lead.assign", "lead.convert", "lead.close",
    "client.view", "client.create", "client.update", "client.viewOthers", "client.viewOutstanding",
    "contact.view", "contact.create", "contact.update",
    "followup.view", "followup.create", "followup.close",
    "complaint.view", "complaint.create",
    "quotation.view", "quotation.create", "quotation.update", "quotation.revise", "quotation.send", "quotation.viewOthers",
    "order.view",
    "project.view", "project.create",
    // Measurement: OWN create · OWN edit · OWN submit · NONE approve · OWN view
    "measurement.view", "measurement.view.own", "measurement.create.own", "measurement.edit.own", "measurement.submit.own",
    "sitelog.view",
    "report.view.dashboard", "report.view.sales",
  ],

  MEASURE_EXEC: [
    "catalog.view",
    "client.view",
    "project.view",
    // Measurement: FULL create · OWN edit · FULL submit · NONE approve · FULL view
    "measurement.view", "measurement.create", "measurement.update", "measurement.delete", "measurement.submit", "measurement.revise",
    "measurement.view.any", "measurement.create.any", "measurement.edit.own", "measurement.submit.any",
    "sitelog.view", "sitelog.create",
    "make.view",
    "install.view",
    "report.view.dashboard",
  ],

  STORE: [
    "catalog.view",
    "vendor.view", "vendor.create", "vendor.update", "vendor.viewRates",
    "requisition.view", "requisition.create", "requisition.approve",
    "po.view", "po.create",
    "grn.view", "grn.create",
    "inventory.view", "inventory.adjust", "inventory.transfer", "inventory.stockTake",
    "stock.view", "stock.allocate", "stock.override",
    "batch.view", "batch.create", "batch.update",
    "serial.view", "serial.assign",
    "allocation.view", "allocation.create", "allocation.release", "allocation.overrideMixedLot",
    "project.view",
    "order.view",
    "make.view",
    "report.view.dashboard", "report.view.stock",
  ],

  MAKE_SUPERVISOR: [
    "catalog.view",
    "project.view",
    "order.view",
    "measurement.view",
    "inventory.view",
    "stock.view",
    "batch.view",
    "make.view", "make.create", "make.update", "make.printCutList",
    "report.view.dashboard",
  ],

  INSTALLER: [
    "catalog.view",
    "project.view",
    "order.view",
    // Measurement: VIEW only (installer sees dimensions but never types them)
    "measurement.view", "measurement.view.any",
    "install.view", "install.create", "install.update", "install.complete", "install.raiseSnag",
    "sitelog.view", "sitelog.create",
    "report.view.dashboard",
  ],

  ACCOUNTS: [
    "catalog.view", "catalog.viewCost",
    "project.view",
    "order.view",
    "client.view", "client.viewOutstanding",
    "invoice.view", "invoice.create", "invoice.cancel", "invoice.viewMargin", "invoice.irnRegenerate", "invoice.irnCancel",
    "receipt.view", "receipt.create", "receipt.allocate", "receipt.reverse",
    "advance.view", "advance.create", "advance.adjust",
    "expense.view", "expense.create", "expense.approve", "expense.reject",
    "pettyCash.view", "pettyCash.manage",
    "employeeAdvance.view", "employeeAdvance.create", "employeeAdvance.recover",
    "payroll.view",
    "report.view.dashboard", "report.view.accounts", "report.view.sales", "report.view.projects", "report.export",
  ],

  HR: [
    "employee.view", "employee.create", "employee.update", "employee.terminate", "employee.viewSalary",
    "attendance.view", "attendance.punch", "attendance.viewOthers", "attendance.edit", "attendance.lock", "attendance.geoFence",
    "leave.view", "leave.apply", "leave.approve", "leave.cancel",
    "payroll.view", "payroll.run", "payroll.viewOthers", "payroll.review", "payroll.finalize", "payroll.bankFile",
    "report.view.dashboard", "report.view.payroll",
  ],
};

export async function seedRoles(
  db: PrismaClient,
  orgId: string,
  userByRole: Record<string, string>,
): Promise<{ roleIdByAppRole: Record<string, string> }> {
  const roleIdByAppRole: Record<string, string> = {};

  for (const [appRole, meta] of Object.entries(ROLE_META) as [RoleKey, (typeof ROLE_META)[RoleKey]][]) {
    const role = await db.role.create({
      data: {
        organizationId: orgId,
        name:           meta.name,
        description:    meta.description,
        isOwnerRole:    meta.isOwnerRole ?? false,
        isSystem:       true,
      },
      select: { id: true },
    });
    roleIdByAppRole[appRole] = role.id;

    if (appRole !== "OWNER") {
      const perms = ROLE_PERMISSIONS[appRole as Exclude<RoleKey, "OWNER">];
      if (perms.length > 0) {
        await db.rolePermission.createMany({
          data: perms.map((key) => ({ roleId: role.id, key, scope: "FULL" as const })),
        });
      }
    } else {
      // Owner: seed deny carveouts so measurement.create/edit/submit
      // return 403 even though isOwnerRole=true grants everything else.
      await db.rolePermission.createMany({
        data: OWNER_DENIES.map((key) => ({ roleId: role.id, key, scope: "NONE" as const })),
      });
    }
  }

  // Backfill User.roleId for the seeded users
  const updates = Object.entries(userByRole)
    .map(([appRole, userId]) => ({ userId, roleId: roleIdByAppRole[appRole] }))
    .filter((u): u is { userId: string; roleId: string } => Boolean(u.roleId));

  for (const { userId, roleId } of updates) {
    await db.user.update({ where: { id: userId }, data: { roleId } });
  }

  return { roleIdByAppRole };
}
