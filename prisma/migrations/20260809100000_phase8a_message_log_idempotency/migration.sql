-- §15 rule 10 / §0.8 — caller-supplied idempotencyKey on
-- MessageLog makes a retried WhatsApp send a no-op. Unique-per-org
-- so a caller can't accidentally collide, nullable so system-
-- internal messages without a natural key can skip it.

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex — partial unique so multiple NULL rows are legal
-- but any non-null value uniques per (orgId, key). Postgres
-- convention: a plain unique on nullable columns already ignores
-- NULLs, but we make it explicit with WHERE for clarity.
CREATE UNIQUE INDEX "MessageLog_orgId_idempotencyKey_key"
  ON "MessageLog"("orgId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
