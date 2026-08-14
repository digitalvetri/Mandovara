-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('DISPATCH', 'INSTALL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InstallStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "InstallStatus" ADD VALUE 'CUSTOMER_CONFIRMED';
ALTER TYPE "InstallStatus" ADD VALUE 'SNAGGING';
ALTER TYPE "InstallStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "InstallVisit" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "customerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "VisitKind" NOT NULL DEFAULT 'DISPATCH';

-- AlterTable
ALTER TABLE "Snag" ADD COLUMN     "installVisitId" TEXT;

-- CreateTable
CREATE TABLE "InstallVisitEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallVisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallVisitEvent_visitId_createdAt_idx" ON "InstallVisitEvent"("visitId", "createdAt");

-- CreateIndex
CREATE INDEX "InstallVisit_organizationId_kind_status_idx" ON "InstallVisit"("organizationId", "kind", "status");

-- CreateIndex
CREATE INDEX "Snag_installVisitId_idx" ON "Snag"("installVisitId");

-- AddForeignKey
ALTER TABLE "InstallVisitEvent" ADD CONSTRAINT "InstallVisitEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "InstallVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snag" ADD CONSTRAINT "Snag_installVisitId_fkey" FOREIGN KEY ("installVisitId") REFERENCES "InstallVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
