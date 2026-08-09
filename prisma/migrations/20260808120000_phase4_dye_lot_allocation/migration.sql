-- Phase 4: dye-lot on Batch + GRNLine, new LotAllocation model.
-- §0.6 sacred rule: mixed-lot allocation is blocked at the action layer;
-- the schema keeps the shape (mixedLotOverride + reason) so the audit trail
-- exists when a supervisor does override. StockLedgerEntry is unchanged
-- (already carries batchId + is append-only).

-- AlterTable Batch — add roll-goods fields.
ALTER TABLE "Batch"
  ADD COLUMN "rollCount"    INTEGER,
  ADD COLUMN "rollLengthsM" JSONB,
  ADD COLUMN "binLocation"  TEXT;

-- AlterTable GRNLine — capture dye-lot info on receipt.
ALTER TABLE "GRNLine"
  ADD COLUMN "rollCount"    INTEGER,
  ADD COLUMN "rollLengthsM" JSONB,
  ADD COLUMN "binLocation"  TEXT;

-- CreateTable LotAllocation.
CREATE TABLE "LotAllocation" (
    "id"               TEXT NOT NULL,
    "orgId"            TEXT NOT NULL,
    "orderLineId"      TEXT NOT NULL,
    "batchId"          TEXT NOT NULL,
    "quantity"         DECIMAL(18,4) NOT NULL,
    "mixedLotOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason"   TEXT,
    "overrideById"     TEXT,
    "releasedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"      TEXT,

    CONSTRAINT "LotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LotAllocation_orgId_orderLineId_idx" ON "LotAllocation"("orgId", "orderLineId");
CREATE INDEX "LotAllocation_orgId_batchId_idx"     ON "LotAllocation"("orgId", "batchId");

-- AddForeignKey
ALTER TABLE "LotAllocation"
  ADD CONSTRAINT "LotAllocation_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LotAllocation"
  ADD CONSTRAINT "LotAllocation_orderLineId_fkey"
  FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
