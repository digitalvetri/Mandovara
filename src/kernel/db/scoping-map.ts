// Scoping map — which Prisma models carry orgId, and which also carry branchId.
// Kept in a separate file to keep scoped.ts readable and easy to review.
//
// Convention (docs/BUILD-SPEC.md §9.1):
//   - Tenant-scoped models have an orgId column. Every read/write is filtered
//     by ctx.orgId, and every create/update writes it.
//   - Branch-scoped models additionally carry branchId. When the caller's
//     branchScope is MEMBERS (not ALL), reads are filtered to ctx.branchIds.
//   - Child models (QuotationLine, InvoiceLine, Rack, Bin, ...) do NOT
//     appear here. They are scoped implicitly via their parent's query.

/** Every Prisma model that has an orgId column. Reads and writes are scoped. */
export const TENANT_SCOPED = new Set<string>([
  // kernel
  "Branch", "User", "Role", "NumberingSeries", "AuditLog", "Approval",
  // catalog
  "Category", "Product",
  // inventory
  "Warehouse", "Batch", "SerialNumber",
  "StockLedgerEntry", "StockBalance", "StockTransfer", "StockAdjustment", "StockTake",
  // customer
  "Lead", "Client", "PriceSlab", "Complaint",
  "Architect", "ArchitectCommission",
  // procurement
  "Vendor", "PurchaseRequisition", "PurchaseOrder", "GRN", "VendorPayment",
  // sales
  "Quotation", "SalesOrder", "Reservation", "Dispatch", "DeliveryChallan",
  // finance
  "Invoice", "Receipt",
  "Advance", "Payment", "ExpenseHead", "Expense", "PettyCash", "EmployeeAdvance",
  // projects
  "Project", "MaterialIssue", "SiteLog", "ProjectExpense",
  // people
  "Employee", "Shift", "Attendance", "Leave", "LeaveBalance",
  "SalaryStructure", "PayrollRun", "Payslip", "StatutorySlab",
  // automation
  "AutomationRule", "MessageTemplate", "MessageLog", "WhatsAppConversation",
  "Notification", "FollowUp",
  // platform
  "SavedView", "Setting", "ImportJob", "ExportJob",
]);

/** Subset of TENANT_SCOPED that ALSO has a branchId column. */
export const BRANCH_SCOPED = new Set<string>([
  "Branch",
  "Lead",
  "PurchaseRequisition", "PurchaseOrder", "GRN", "VendorPayment",
  "Quotation", "SalesOrder", "Dispatch", "DeliveryChallan",
  "Invoice", "Receipt",
  "Advance", "Payment", "Expense", "PettyCash",
  "Project", "Employee", "PayrollRun",
]);

/**
 * Models EXEMPT from the audit-log extension.
 *   - AuditLog itself — would cause infinite recursion.
 *   - StockLedgerEntry — already immutable + already carries full provenance.
 */
export const AUDIT_EXEMPT = new Set<string>(["AuditLog", "StockLedgerEntry"]);
