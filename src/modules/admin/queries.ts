// Admin & Roles — real reads only.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface UserRow {
  id: string; name: string; email: string; role: string; branchLabel: string;
}
export interface MatrixRow { module: string; view: boolean; create: boolean; approve: boolean; delete: boolean; }
export interface AuditRow  { id: string; when: string; actor: string; action: string; entity: string; }
export interface CompanySettings {
  orgId: string;
  orgName: string;
  fyStartMonth: number;
  fyLabel: string;
  gstin: string | null;
  invoiceSeries: string;
}
export interface AdminView {
  users: UserRow[];
  matrix: MatrixRow[];
  audit: AuditRow[];
  company: CompanySettings;
  branches: { id: string; name: string; invoicePrefix: string }[];
  roles: { id: string; name: string }[];
}

const MATRIX_ROWS = [
  { module: "Leads & Quotes" },
  { module: "Orders & Dispatch" },
  { module: "Invoices" },
  { module: "Stock & GRN" },
  { module: "Payroll (finance)" },
  { module: "Admin" },
] as const;

export async function loadAdmin(ctx: RequestContext): Promise<AdminView> {
  requirePermission(ctx, "admin.settings");
  const db = scoped(ctx);

  const [users, org, branches, audit, roles] = await Promise.all([
    db.user.findMany({
      take: 20, orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, branchIds: true,
        userRoles: { select: { role: { select: { name: true } } }, take: 1 },
      },
    }),
    db.organization.findFirst({
      select: { id: true, name: true, gstin: true, fyStartMonth: true },
    }),
    db.branch.findMany({ select: { id: true, name: true, invoicePrefix: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, createdAt: true, actorId: true, action: true, entityType: true },
    }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const primaryBranch = branches[0];

  const userRows: UserRow[] = users.map((u) => ({
    id: u.id, name: u.name, email: u.email ?? "—",
    role: u.userRoles[0]?.role.name ?? "Unassigned",
    branchLabel: labelBranches(u.branchIds, branchNameById),
  }));

  // Resolve actor names in one round-trip so the log reads "Anbu Kumar"
  // instead of the raw cuid tail.
  const actorIds = [...new Set(audit.map((a) => a.actorId).filter((x): x is string => !!x))];
  const actorsById = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    for (const u of actors) actorsById.set(u.id, u.name);
  }
  const auditRows: AuditRow[] = audit.map((a) => ({
    id:     a.id,
    when:   relTime(a.createdAt),
    actor:  a.actorId ? (actorsById.get(a.actorId) ?? "Unknown") : "System",
    action: humaniseAction(a.action),
    entity: humaniseEntity(a.entityType),
  }));

  const matrix: MatrixRow[] = MATRIX_ROWS.map((r, i) => ({
    module: r.module,
    view: true, create: i < 4, approve: i === 2 || i === 4, delete: i === 5,
  }));

  return {
    users: userRows,
    matrix,
    audit: auditRows,
    company: {
      orgId:         org?.id ?? "",
      orgName:       org?.name ?? "",
      fyStartMonth:  org?.fyStartMonth ?? 4,
      fyLabel:       fyLabel(org?.fyStartMonth ?? 4),
      gstin:         org?.gstin ?? null,
      invoiceSeries: primaryBranch?.invoicePrefix ?? "",
    },
    branches, roles,
  };
}

function fyLabel(m: number): string {
  const start = new Date(0, m - 1, 1).toLocaleDateString("en", { month: "long" });
  const end   = new Date(0, ((m + 10) % 12), 1).toLocaleDateString("en", { month: "long" });
  return `${start}–${end}`;
}
function labelBranches(ids: string[], map: Map<string, string>): string {
  if (ids.length === 0) return "—";
  if (ids.length === map.size) return "All";
  return ids.map((id) => map.get(id) ?? "?").join(", ");
}
function relTime(when: Date): string {
  const mins = Math.floor((Date.now() - when.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function humaniseAction(a: string): string {
  const map: Record<string, string> = {
    CREATE: "Created", CREATEMANY: "Bulk created",
    UPDATE: "Updated", UPDATEMANY: "Bulk updated",
    UPSERT: "Saved",
    DELETE: "Deleted", DELETEMANY: "Bulk deleted",
  };
  return map[a] ?? (a.charAt(0) + a.slice(1).toLowerCase());
}
function humaniseEntity(e: string): string {
  const map: Record<string, string> = {
    Lead: "Lead", Client: "Client", Quotation: "Quotation",
    SalesOrder: "Sales order", Dispatch: "Dispatch",
    Invoice: "Invoice", Receipt: "Receipt",
    PurchaseOrder: "Purchase order", GRN: "GRN",
    Product: "Product", Category: "Product category",
    StockAdjustment: "Stock adjustment", StockLedgerEntry: "Stock movement",
    Project: "Project", Milestone: "Milestone", Task: "Task",
    SiteLog: "Site log", SnagItem: "Snag",
    FollowUp: "Follow-up",
    User: "User", UserRole: "User role", Role: "Role",
    Employee: "Employee", Attendance: "Attendance", Leave: "Leave",
    PayrollRun: "Payroll run", Payslip: "Payslip", SalaryStructure: "Salary structure",
    MessageTemplate: "Message template", AutomationRule: "Automation rule",
    Organization: "Company settings", Branch: "Branch",
  };
  return map[e] ?? e;
}
