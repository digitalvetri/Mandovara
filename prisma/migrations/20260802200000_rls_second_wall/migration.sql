-- Row-Level Security — the "second wall" (Twelve Rules #1, docs/BUILD-SPEC.md §8.2).
--
-- Design:
--   - RLS is ENABLED and policies are created on every tenant-scoped table.
--   - RLS is NOT FORCE'd yet. The mandovara Postgres user is also the table
--     OWNER, and Postgres RLS is bypassed for owners unless FORCE ROW LEVEL
--     SECURITY is set. Session 7 (real auth) will:
--       * create a non-owner "mandovara_app" role
--       * repoint DATABASE_URL at that role
--       * ALTER TABLE ... FORCE ROW LEVEL SECURITY
--       * wrap every request in SET LOCAL app.org_id = ...
--   - The primary tenant defence is the JS extension in
--     src/kernel/db/scoped.ts. This SQL is defence-in-depth for the future
--     day someone forgets to route through it.
--
-- Policies use current_setting('app.org_id', true). The `true` second arg
-- makes it return NULL if unset, which the policy handles.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Branch','User','Role','NumberingSeries','AuditLog','Approval',
    'Category','Product',
    'Warehouse','Batch','SerialNumber',
    'StockLedgerEntry','StockBalance','StockTransfer','StockAdjustment','StockTake',
    'Lead','Client','PriceSlab','Complaint',
    'Vendor','PurchaseRequisition','PurchaseOrder','GRN','VendorPayment',
    'Quotation','SalesOrder','Reservation','Dispatch','DeliveryChallan',
    'Invoice','Receipt',
    'Advance','Payment','ExpenseHead','Expense','PettyCash','EmployeeAdvance',
    'Project','MaterialIssue','SiteLog','ProjectExpense',
    'Employee','Shift','Attendance','Leave','LeaveBalance',
    'SalaryStructure','PayrollRun','Payslip','StatutorySlab',
    'AutomationRule','MessageTemplate','MessageLog','WhatsAppConversation',
    'Notification','FollowUp',
    'SavedView','Setting','ImportJob','ExportJob'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      || 'USING ("orgId" = current_setting(''app.org_id'', true) OR current_setting(''app.org_id'', true) IS NULL) '
      || 'WITH CHECK ("orgId" = current_setting(''app.org_id'', true) OR current_setting(''app.org_id'', true) IS NULL);',
      'org_isolation_' || lower(t), t
    );
  END LOOP;
END $$;
