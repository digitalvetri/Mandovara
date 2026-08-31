-- Quotation edit budget.
--
-- Owner, 2026-08-31: "if an employee prepares a quotation, that can be edited
-- by the employee only for three times; more than three times the quotation
-- should be approved by the admin, then only he can prepare or edit the
-- quotation for the fourth time." Confirmed: approval grants three more.
--
-- Deliberately a new counter rather than reusing `revision`. Revision counts
-- reissues — a fresh document sent to the client — while this counts edits
-- the employee made before sending anything. Reusing it would tie "edits
-- left" to how often the quote was reissued, a different question.
--
-- Existing quotations start at 0, i.e. a full budget. Back-dating a count
-- for edits nobody recorded would lock people out of quotes they were
-- midway through.
ALTER TABLE "Quotation" ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN "editsUnlockedById" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "editsUnlockedAt" TIMESTAMP(3);
