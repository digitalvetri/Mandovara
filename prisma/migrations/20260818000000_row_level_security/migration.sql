-- §3.2 Row-Level Security — the second wall.
--
-- Until now isolation was enforced only by the Prisma `scoped(ctx)` extension.
-- §3.2 requires a database-level policy on every org-owned table: application
-- filtering is not isolation. Zero tables had RLS enabled before this migration
-- (verified: SELECT count(*) FROM pg_class WHERE relrowsecurity -> 0).
--
-- Model:
--   * current_org_id() reads the `app.current_org_id` GUC. Unset -> NULL ->
--     no row satisfies the policy -> DENY BY DEFAULT. A code path that forgets
--     to set the tenant sees an empty database, never another tenant's data.
--   * FORCE ROW LEVEL SECURITY so the table owner (the app's own role) is
--     subject to the policies too. Without FORCE, RLS would be decorative here.
--   * There is deliberately NO in-SQL bypass flag. Postgres already exempts
--     superusers and BYPASSRLS roles from row security, so the seed, the
--     importers, the migrations and the test harness (all of which connect as
--     the owner via DATABASE_URL) are unaffected. A GUC-based escape hatch
--     would have been settable by the application role itself, which would
--     have handed the app a one-line way to unlock every tenant.
--   * The application connects as APP_DATABASE_URL — a role that is NOT
--     superuser and NOT BYPASSRLS. See scripts/setup-app-role.mjs. Without
--     that split these policies are decorative.

CREATE OR REPLACE FUNCTION current_org_id() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.current_org_id', true), '')
  $$;

-- The Organization row itself is keyed by id, not organizationId.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Organization";
CREATE POLICY org_isolation ON "Organization"
  USING       (id = current_org_id())
  WITH CHECK  (id = current_org_id());

ALTER TABLE "Advance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Advance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Advance";
CREATE POLICY org_isolation ON "Advance"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Allocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Allocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Allocation";
CREATE POLICY org_isolation ON "Allocation"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Architect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Architect" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Architect";
CREATE POLICY org_isolation ON "Architect"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ArchitectCommission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArchitectCommission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ArchitectCommission";
CREATE POLICY org_isolation ON "ArchitectCommission"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Attendance";
CREATE POLICY org_isolation ON "Attendance"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "AuditLog";
CREATE POLICY org_isolation ON "AuditLog"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "AutomationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "AutomationLog";
CREATE POLICY org_isolation ON "AutomationLog"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "AutomationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "AutomationRule";
CREATE POLICY org_isolation ON "AutomationRule"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Branch";
CREATE POLICY org_isolation ON "Branch"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Brand";
CREATE POLICY org_isolation ON "Brand"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "CalcResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalcResult" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "CalcResult";
CREATE POLICY org_isolation ON "CalcResult"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "CalendarEvent";
CREATE POLICY org_isolation ON "CalendarEvent"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ChatChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatChannel" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ChatChannel";
CREATE POLICY org_isolation ON "ChatChannel"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ChatMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ChatMember";
CREATE POLICY org_isolation ON "ChatMember"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ChatMessage";
CREATE POLICY org_isolation ON "ChatMessage"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Client";
CREATE POLICY org_isolation ON "Client"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Collection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Collection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Collection";
CREATE POLICY org_isolation ON "Collection"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Colourway" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Colourway" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Colourway";
CREATE POLICY org_isolation ON "Colourway"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "CommunicationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunicationLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "CommunicationLog";
CREATE POLICY org_isolation ON "CommunicationLog"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ContactPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactPerson" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ContactPerson";
CREATE POLICY org_isolation ON "ContactPerson"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Department";
CREATE POLICY org_isolation ON "Department"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Design" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Design" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Design";
CREATE POLICY org_isolation ON "Design"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Document";
CREATE POLICY org_isolation ON "Document"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Employee";
CREATE POLICY org_isolation ON "Employee"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Expense";
CREATE POLICY org_isolation ON "Expense"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUp" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "FollowUp";
CREATE POLICY org_isolation ON "FollowUp"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "GRN" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GRN" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "GRN";
CREATE POLICY org_isolation ON "GRN"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "GRNLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GRNLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "GRNLine";
CREATE POLICY org_isolation ON "GRNLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Holiday";
CREATE POLICY org_isolation ON "Holiday"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "InstallCrew" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallCrew" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "InstallCrew";
CREATE POLICY org_isolation ON "InstallCrew"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "InstallLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "InstallLine";
CREATE POLICY org_isolation ON "InstallLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "InstallVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallVisit" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "InstallVisit";
CREATE POLICY org_isolation ON "InstallVisit"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "InstallVisitEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallVisitEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "InstallVisitEvent";
CREATE POLICY org_isolation ON "InstallVisitEvent"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Invoice";
CREATE POLICY org_isolation ON "Invoice"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "InvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "InvoiceLine";
CREATE POLICY org_isolation ON "InvoiceLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Lead";
CREATE POLICY org_isolation ON "Lead"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Leave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Leave" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Leave";
CREATE POLICY org_isolation ON "Leave"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "LeaveBalance";
CREATE POLICY org_isolation ON "LeaveBalance"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MakeJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MakeJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MakeJob";
CREATE POLICY org_isolation ON "MakeJob"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MakeJobEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MakeJobEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MakeJobEvent";
CREATE POLICY org_isolation ON "MakeJobEvent"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MakeJobLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MakeJobLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MakeJobLine";
CREATE POLICY org_isolation ON "MakeJobLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Measurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Measurement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Measurement";
CREATE POLICY org_isolation ON "Measurement"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MeasurementItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeasurementItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MeasurementItem";
CREATE POLICY org_isolation ON "MeasurementItem"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MessageTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MessageTemplate";
CREATE POLICY org_isolation ON "MessageTemplate"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Milestone";
CREATE POLICY org_isolation ON "Milestone"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "MilestoneTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MilestoneTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "MilestoneTemplate";
CREATE POLICY org_isolation ON "MilestoneTemplate"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Notification";
CREATE POLICY org_isolation ON "Notification"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "NumberSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NumberSequence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "NumberSequence";
CREATE POLICY org_isolation ON "NumberSequence"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Order";
CREATE POLICY org_isolation ON "Order"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "OrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "OrderLine";
CREATE POLICY org_isolation ON "OrderLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "POLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "POLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "POLine";
CREATE POLICY org_isolation ON "POLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Payment";
CREATE POLICY org_isolation ON "Payment"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PaymentAllocation";
CREATE POLICY org_isolation ON "PaymentAllocation"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PayrollRun";
CREATE POLICY org_isolation ON "PayrollRun"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Payslip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payslip" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Payslip";
CREATE POLICY org_isolation ON "Payslip"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Price" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Price" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Price";
CREATE POLICY org_isolation ON "Price"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Project";
CREATE POLICY org_isolation ON "Project"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ProjectDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ProjectDocument";
CREATE POLICY org_isolation ON "ProjectDocument"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ProjectExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectExpense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ProjectExpense";
CREATE POLICY org_isolation ON "ProjectExpense"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ProjectMember";
CREATE POLICY org_isolation ON "ProjectMember"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PromiseToPay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromiseToPay" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PromiseToPay";
CREATE POLICY org_isolation ON "PromiseToPay"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PurchaseOrder";
CREATE POLICY org_isolation ON "PurchaseOrder"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PurchaseRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PurchaseRequest";
CREATE POLICY org_isolation ON "PurchaseRequest"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "PurchaseRequestLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseRequestLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PurchaseRequestLine";
CREATE POLICY org_isolation ON "PurchaseRequestLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Quotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quotation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Quotation";
CREATE POLICY org_isolation ON "Quotation"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "QuotationLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuotationLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "QuotationLine";
CREATE POLICY org_isolation ON "QuotationLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Receipt";
CREATE POLICY org_isolation ON "Receipt"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ReceiptAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReceiptAllocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ReceiptAllocation";
CREATE POLICY org_isolation ON "ReceiptAllocation"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Role";
CREATE POLICY org_isolation ON "Role"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Room";
CREATE POLICY org_isolation ON "Room"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "SampleBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SampleBook" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "SampleBook";
CREATE POLICY org_isolation ON "SampleBook"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "SampleIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SampleIssue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "SampleIssue";
CREATE POLICY org_isolation ON "SampleIssue"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "SavedView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedView" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "SavedView";
CREATE POLICY org_isolation ON "SavedView"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "ServiceRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "ServiceRate";
CREATE POLICY org_isolation ON "ServiceRate"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Setting";
CREATE POLICY org_isolation ON "Setting"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "SiteLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "SiteLog";
CREATE POLICY org_isolation ON "SiteLog"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "SiteVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteVisit" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "SiteVisit";
CREATE POLICY org_isolation ON "SiteVisit"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Snag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Snag" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Snag";
CREATE POLICY org_isolation ON "Snag"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "StatutorySlab" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatutorySlab" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "StatutorySlab";
CREATE POLICY org_isolation ON "StatutorySlab"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "StockBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockBalance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "StockBalance";
CREATE POLICY org_isolation ON "StockBalance"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "StockMove" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMove" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "StockMove";
CREATE POLICY org_isolation ON "StockMove"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Task";
CREATE POLICY org_isolation ON "Task"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "TaskComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskComment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "TaskComment";
CREATE POLICY org_isolation ON "TaskComment"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "User";
CREATE POLICY org_isolation ON "User"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Vendor";
CREATE POLICY org_isolation ON "Vendor"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "WhatsAppConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConversation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "WhatsAppConversation";
CREATE POLICY org_isolation ON "WhatsAppConversation"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());
