-- Enforce one active TAX invoice per Sales Order.
-- This is a PARTIAL unique index — it cannot be expressed as @@unique in the
-- Prisma schema, so it lives here as raw SQL.
--
-- The constraint allows:
--   • Multiple CANCELLED invoices for the same order (reversal history).
--   • Credit notes / proforma invoices for the same order (different type).
--
-- Step 1: cancel older duplicate active TAX invoices (keep the most recent per
-- orderId). This is a no-op when no duplicates exist; it makes the index
-- creation below safe for production data that may have had duplicates before
-- this constraint was introduced.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "orderId"
      ORDER BY "date" DESC, id DESC
    ) AS rn
  FROM "Invoice"
  WHERE "orderId" IS NOT NULL
    AND "status" <> 'CANCELLED'
    AND "type" = 'TAX'
)
UPDATE "Invoice" SET "status" = 'CANCELLED'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: create the partial unique index. Will succeed now that all duplicate
-- active-TAX rows per orderId have been cancelled above.
CREATE UNIQUE INDEX "invoice_order_active_unique"
  ON "Invoice" ("organizationId", "orderId")
  WHERE "orderId" IS NOT NULL
    AND "status" <> 'CANCELLED'
    AND "type" = 'TAX';
