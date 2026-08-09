-- Keeping the three raw-SQL GIN indexes on Product (same rationale
-- as 20260809042151_phase2_measurement_persistence and every later
-- migration through phase5c). Catalog search p95 depends on them.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "architectId" TEXT;

-- CreateTable
CREATE TABLE "Architect" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "address" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Architect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchitectCommission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "baseAmount" BIGINT NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ArchitectCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Architect_orgId_isActive_idx" ON "Architect"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Architect_orgId_code_key" ON "Architect"("orgId", "code");

-- CreateIndex
CREATE INDEX "ArchitectCommission_orgId_architectId_paidAt_idx" ON "ArchitectCommission"("orgId", "architectId", "paidAt");

-- CreateIndex
CREATE INDEX "ArchitectCommission_orgId_cancelledAt_idx" ON "ArchitectCommission"("orgId", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchitectCommission_salesOrderId_key" ON "ArchitectCommission"("salesOrderId");

-- CreateIndex
CREATE INDEX "Client_orgId_architectId_idx" ON "Client"("orgId", "architectId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchitectCommission" ADD CONSTRAINT "ArchitectCommission_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchitectCommission" ADD CONSTRAINT "ArchitectCommission_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
