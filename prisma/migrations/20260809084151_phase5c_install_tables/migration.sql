-- Keeping the three raw-SQL GIN indexes on Product (same rationale
-- as 20260809042151_phase2_measurement_persistence,
-- 20260809050312_phase3_measurement_gate, 20260809065454_phase5a).
-- Catalog search p95 depends on them.

-- CreateEnum
CREATE TYPE "InstallStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'RESCHEDULED', 'CANCELLED');

-- Prisma sees MakeJob_salesOrderId_idx as redundant with the newer
-- MakeJob_salesOrderId_key unique index (Phase 5a). Dropping the
-- plain index is safe — the unique index serves the same lookups.
-- IF EXISTS so re-running against a DB that never had the plain
-- index doesn't error.
DROP INDEX IF EXISTS "MakeJob_salesOrderId_idx";

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "installedQty" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InstallCrew" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadEmployeeId" TEXT,
    "memberEmployeeIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallVisit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "crewId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "InstallStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rescheduleReason" TEXT,
    "clientSignatureKey" TEXT,
    "photoKeys" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "InstallVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallLine" (
    "id" TEXT NOT NULL,
    "installVisitId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "roomLabel" TEXT NOT NULL,
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "installedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "dyeLotUsed" TEXT,
    "remoteSerials" TEXT[],
    "photoKeys" TEXT[],
    "issue" TEXT,

    CONSTRAINT "InstallLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallCrew_orgId_isActive_idx" ON "InstallCrew"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InstallCrew_orgId_name_key" ON "InstallCrew"("orgId", "name");

-- CreateIndex
CREATE INDEX "InstallVisit_orgId_scheduledAt_status_idx" ON "InstallVisit"("orgId", "scheduledAt", "status");

-- CreateIndex
CREATE INDEX "InstallVisit_salesOrderId_idx" ON "InstallVisit"("salesOrderId");

-- CreateIndex
CREATE INDEX "InstallVisit_crewId_scheduledAt_idx" ON "InstallVisit"("crewId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstallVisit_orgId_number_key" ON "InstallVisit"("orgId", "number");

-- CreateIndex
CREATE INDEX "InstallLine_installVisitId_idx" ON "InstallLine"("installVisitId");

-- CreateIndex
CREATE INDEX "InstallLine_orderLineId_idx" ON "InstallLine"("orderLineId");

-- AddForeignKey
ALTER TABLE "InstallVisit" ADD CONSTRAINT "InstallVisit_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallVisit" ADD CONSTRAINT "InstallVisit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "InstallCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallLine" ADD CONSTRAINT "InstallLine_installVisitId_fkey" FOREIGN KEY ("installVisitId") REFERENCES "InstallVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallLine" ADD CONSTRAINT "InstallLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
