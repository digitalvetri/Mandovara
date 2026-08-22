-- Enforce one active TAX invoice per Sales Order.
-- This is a PARTIAL unique index — it cannot be expressed as @@unique in the
-- Prisma schema, so it lives here as raw SQL.
--
-- The constraint allows:
--   • Multiple CANCELLED invoices for the same order (reversal history).
--   • Credit notes / proforma invoices for the same order (different type).
--
-- If this migration fails with "could not create unique index",
-- existing duplicate active invoices must be resolved first. Identify them:
--
--   SELECT "orderId", COUNT(*) n FROM "Invoice"
--   WHERE "orderId" IS NOT NULL AND "status" <> 'CANCELLED' AND "type" = 'TAX'
--   GROUP BY "orderId" HAVING COUNT(*) > 1;
--
-- Cancel the duplicates (keep the most recent), then re-run the migration.

CREATE UNIQUE INDEX "invoice_order_active_unique"
  ON "Invoice" ("organizationId", "orderId")
  WHERE "orderId" IS NOT NULL
    AND "status" <> 'CANCELLED'
    AND "type" = 'TAX';
