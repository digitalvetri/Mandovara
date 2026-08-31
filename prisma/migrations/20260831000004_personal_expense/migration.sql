-- The owner's own spending — fuel, food, household.
--
-- Deliberately a new table, not a category on Expense. That table carries
-- GST fields, approvalState, branchId and sourcePoId, and it feeds the P&L,
-- the "To Pay" KPI and the monthly GST filing. A household grocery bill in
-- there would corrupt all three. This is a private notebook that happens to
-- live in the same app.
--
-- Scoped to the user as well as the org: two owners in one organization must
-- not see each other's personal spending.
CREATE TABLE "PersonalExpense" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "category"       TEXT NOT NULL,
    "note"           TEXT,
    "amount"         BIGINT NOT NULL,
    "spentAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalExpense_organizationId_userId_spentAt_idx"
  ON "PersonalExpense"("organizationId", "userId", "spentAt");

-- §3.2 — every org-owned table carries the same deny-by-default policy.
-- Without this the restricted app role cannot read or write it at all.
ALTER TABLE "PersonalExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalExpense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PersonalExpense";
CREATE POLICY org_isolation ON "PersonalExpense"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());
