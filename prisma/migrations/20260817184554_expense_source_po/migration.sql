-- Track which Purchase Order (if any) auto-created this Expense.
-- Unique so a subsequent GRN on the same PO can't spawn a duplicate.
-- Deliberately not a foreign key — POs can be archived independently
-- of the ledger row they seeded.

ALTER TABLE "Expense" ADD COLUMN "sourcePoId" TEXT;

CREATE UNIQUE INDEX "Expense_sourcePoId_key" ON "Expense"("sourcePoId");
