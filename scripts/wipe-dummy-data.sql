-- Wipe seeded transactional data. Keep:
--   Organization, Branch, User, UserRole, Role, RolePermission,
--   Category, Product, ProductPrice, SpecTemplate, PriceSlab,
--   Vendor, Warehouse, Rack, Bin,
--   Employee, SalaryStructure, SalaryComponent,
--   StatutorySlab, MessageTemplate, Setting, ExpenseHead,
--   NumberingSeries (counters reset to 0)

DO $$
BEGIN
  -- AuditLog and StockLedgerEntry have triggers blocking UPDATE/DELETE.
  ALTER TABLE "AuditLog"         DISABLE TRIGGER USER;
  ALTER TABLE "StockLedgerEntry" DISABLE TRIGGER USER;

  TRUNCATE TABLE
    "Lead", "LeadActivity",
    "Client", "ContactPerson", "Address", "CreditLimit",
    "Project", "ProjectExpense", "Milestone", "SiteLog", "Handover",
    "SnagItem", "Complaint",
    "Quotation", "QuotationLine",
    "SalesOrder", "OrderLine",
    "PurchaseRequisition", "PurchaseOrder", "POLine",
    "GRN", "GRNLine",
    "Invoice", "InvoiceLine",
    "Advance", "Payment", "Receipt", "ReceiptAllocation", "VendorPayment",
    "StockLedgerEntry", "StockBalance", "StockAdjustment",
    "StockTake", "StockTakeLine", "StockTransfer", "MaterialIssue",
    "Reservation", "Batch", "SerialNumber",
    "Dispatch", "DispatchLine", "DeliveryChallan",
    "Task", "Approval",
    "Attendance", "Leave", "LeaveBalance",
    "PayrollRun", "Payslip", "EmployeeAdvance",
    "Expense", "PettyCash",
    "MessageLog", "WhatsAppConversation", "Notification",
    "FollowUp",
    "AuditLog", "SavedView", "ImportJob", "ExportJob", "AutomationRule",
    "ProductDocument"
    RESTART IDENTITY CASCADE;

  ALTER TABLE "AuditLog"         ENABLE TRIGGER USER;
  ALTER TABLE "StockLedgerEntry" ENABLE TRIGGER USER;

  -- Reset document-number sequences so new invoices/quotes start at 1.
  UPDATE "NumberingSeries" SET "currentValue" = 0;
END $$;
