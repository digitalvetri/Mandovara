-- Keeping the three raw-SQL GIN indexes on Product (see the note on
-- 20260809042151_phase2_measurement_persistence). Prisma's generator
-- wants to drop them because they were added by raw SQL and are not
-- expressible in schema.prisma; catalog search p95 depends on them.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "requiresMeasurement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuotationLine" ADD COLUMN     "calcSnapshot" JSONB,
ADD COLUMN     "measurementItemId" TEXT;

-- CreateIndex
CREATE INDEX "QuotationLine_measurementItemId_idx" ON "QuotationLine"("measurementItemId");

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
