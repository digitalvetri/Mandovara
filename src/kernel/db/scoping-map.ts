// Scoping map — which Prisma models carry organizationId, and which also
// carry branchId. Kept separate to keep scoped.ts readable.
//
// Convention (CLAUDE.md §3.2):
//   - Tenant-scoped models have an organizationId column. Every read/write
//     is filtered by ctx.orgId, and every create writes it.
//   - Branch-scoped models additionally carry branchId. When the caller's
//     branchScope is MEMBERS, reads are filtered to ctx.branchIds.
//   - Child models (QuotationLine, OrderLine, MeasurementItem, etc.) do NOT
//     appear here — scoped implicitly via their parent's query.

/** Every Prisma model that has an organizationId column. */
export const TENANT_SCOPED = new Set<string>([
  // kernel / platform
  "Branch", "User", "NumberSequence", "AuditLog", "SavedView", "Setting",
  // catalog
  "Brand", "Collection", "Design", "Colourway", "Price", "ServiceRate",
  // sample library
  "SampleBook", "SampleIssue",
  // CRM
  "Lead", "Client", "ContactPerson", "Architect", "ArchitectCommission",
  // projects
  "Project", "ProjectMember", "Room", "Milestone", "MilestoneTemplate", "SiteLog",
  "Measurement", "MeasurementItem", "CalcResult", "SiteVisit",
  // collaboration (tasks linked to projects)
  "Task",
  // commerce
  "Quotation", "Order",
  // procurement & stock
  "Vendor", "PurchaseOrder", "GRN", "VendorBill", "StockBalance", "StockMove", "Allocation",
  "PurchaseRequest", "PurchaseRequestLine",
  // make
  "MakeJob",
  // money
  "Invoice", "Advance", "Receipt", "ProjectExpense", "Expense",
  // HR
  "Employee", "Attendance", "Leave", "StatutorySlab", "PayrollRun",
  // automation
  "MessageTemplate", "AutomationLog", "WhatsAppConversation",
  "AutomationRule", "FollowUp",
]);

/** Subset of TENANT_SCOPED that also has a branchId column. */
export const BRANCH_SCOPED = new Set<string>([
  "Project",
  "Quotation",
  "Order",
  "PurchaseOrder",
  "GRN",
  "Invoice",
  "Advance",
  "Expense",
]);

/**
 * Models exempt from the audit-log extension:
 *   - AuditLog itself — would cause infinite recursion.
 *   - StockMove — append-only ledger; its refType/refId IS the audit trail.
 */
export const AUDIT_EXEMPT = new Set<string>(["AuditLog", "StockMove"]);
