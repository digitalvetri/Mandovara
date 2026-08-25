-- Credit-note reason + link to the original invoice being reversed.
-- Both are nullable; only populated when Invoice.type = 'CREDIT_NOTE'.

ALTER TABLE "Invoice"
  ADD COLUMN "creditNoteReason" TEXT,
  ADD COLUMN "originalInvoiceId" TEXT;

CREATE INDEX "Invoice_organizationId_originalInvoiceId_idx"
  ON "Invoice" ("organizationId", "originalInvoiceId");
