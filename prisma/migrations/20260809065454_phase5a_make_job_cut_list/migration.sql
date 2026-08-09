-- Keeping the three raw-SQL GIN indexes on Product (see the note on
-- 20260809042151_phase2_measurement_persistence and repeated on
-- 20260809050312_phase3_measurement_gate). Prisma's generator wants
-- to drop them because they were added by raw SQL and are not
-- expressible in schema.prisma; catalog search p95 depends on them.

-- CreateEnum
CREATE TYPE "MakeJobStatus" AS ENUM ('QUEUED', 'CUTTING', 'STITCHING', 'FINISHING', 'QC', 'READY', 'DELIVERED');

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "calcSnapshot" JSONB,
ADD COLUMN     "measurementItemId" TEXT;

-- CreateTable
CREATE TABLE "MakeJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "vendorId" TEXT,
    "status" "MakeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "assignedToId" TEXT,
    "targetDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MakeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeJobLine" (
    "id" TEXT NOT NULL,
    "makeJobId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "measurementItemId" TEXT,
    "roomLabel" TEXT NOT NULL,
    "panels" INTEGER,
    "cutLengthMm" DECIMAL(10,2),
    "fabricIssuedM" DECIMAL(12,3),
    "liningIssuedM" DECIMAL(12,3),
    "actualUsedM" DECIMAL(12,3),
    "wastageM" DECIMAL(12,3),
    "headingType" TEXT,
    "eyeletCount" INTEGER,
    "stitchSpec" TEXT,
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcNotes" TEXT,

    CONSTRAINT "MakeJobLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakeJob_orgId_status_idx" ON "MakeJob"("orgId", "status");

-- CreateIndex
CREATE INDEX "MakeJob_salesOrderId_idx" ON "MakeJob"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MakeJob_orgId_number_key" ON "MakeJob"("orgId", "number");

-- CreateIndex
CREATE INDEX "MakeJobLine_makeJobId_idx" ON "MakeJobLine"("makeJobId");

-- CreateIndex
CREATE INDEX "MakeJobLine_orderLineId_idx" ON "MakeJobLine"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderLine_measurementItemId_idx" ON "OrderLine"("measurementItemId");

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeJob" ADD CONSTRAINT "MakeJob_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeJobLine" ADD CONSTRAINT "MakeJobLine_makeJobId_fkey" FOREIGN KEY ("makeJobId") REFERENCES "MakeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeJobLine" ADD CONSTRAINT "MakeJobLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
