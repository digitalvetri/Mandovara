// One-time script: seed Role + RolePermission rows for the existing org,
// then backfill User.roleId. Safe to run multiple times (upserts).
//
// Run: npx tsx scripts/backfill-roles.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: [] });

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
    "measurement.view", "measurement.create", "measurement.update",
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
    "measurement.view",
    "sitelog.view",
    "report.view.dashboard", "report.view.sales",
  ],
  MEASURE_EXEC: [
    "catalog.view",
    "client.view",
    "project.view",
    "measurement.view", "measurement.create", "measurement.update", "measurement.delete",
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
    "stock.view",
    "batch.view", "batch.create", "batch.update",
    "serial.view", "serial.assign",
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
    "measurement.view",
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

async function main() {
  // Get the org
  const org = await db.organization.findFirstOrThrow({ select: { id: true, name: true } });
  process.stdout.write(`Org: ${org.name} (${org.id})\n`);

  const roleIdByAppRole: Record<string, string> = {};

  for (const [appRole, meta] of Object.entries(ROLE_META) as [RoleKey, (typeof ROLE_META)[RoleKey]][]) {
    // Upsert role
    const role = await db.role.upsert({
      where:  { organizationId_name: { organizationId: org.id, name: meta.name } },
      create: { organizationId: org.id, name: meta.name, description: meta.description, isOwnerRole: meta.isOwnerRole ?? false, isSystem: true },
      update: { description: meta.description, isOwnerRole: meta.isOwnerRole ?? false, isSystem: true },
      select: { id: true },
    });
    roleIdByAppRole[appRole] = role.id;
    process.stdout.write(`  Role ${appRole}: ${role.id}\n`);

    // Upsert permissions
    if (appRole !== "OWNER") {
      const perms = ROLE_PERMISSIONS[appRole as Exclude<RoleKey, "OWNER">];
      for (const key of perms) {
        await db.rolePermission.upsert({
          where:  { roleId_key: { roleId: role.id, key } },
          create: { roleId: role.id, key, scope: "FULL" },
          update: { scope: "FULL" },
        });
      }
      process.stdout.write(`    → ${perms.length} permissions\n`);
    } else {
      process.stdout.write(`    → all (isOwnerRole)\n`);
    }
  }

  // Backfill User.roleId
  const users = await db.user.findMany({
    where:  { organizationId: org.id },
    select: { id: true, role: true },
  });

  for (const user of users) {
    const roleId = roleIdByAppRole[user.role as string];
    if (roleId) {
      await db.user.update({ where: { id: user.id }, data: { roleId } });
    }
  }
  process.stdout.write(`Backfilled roleId for ${users.length} users\n`);
  process.stdout.write("Done.\n");
}

main()
  .catch((e) => { process.stderr.write(String(e) + "\n"); process.exit(1); })
  .finally(() => db.$disconnect());
