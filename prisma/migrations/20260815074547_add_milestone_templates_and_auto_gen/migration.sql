-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingWeightPct" DECIMAL(5,2),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "family" "ProductFamily",
ADD COLUMN     "plannedAt" TIMESTAMP(3),
ADD COLUMN     "sourceEvent" TEXT,
ADD COLUMN     "templateCode" TEXT;

-- CreateTable
CREATE TABLE "MilestoneTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "family" "ProductFamily",
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingWeightPct" DECIMAL(5,2) NOT NULL,
    "autoCompleteOn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneTemplate_organizationId_family_sequence_idx" ON "MilestoneTemplate"("organizationId", "family", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneTemplate_organizationId_family_code_key" ON "MilestoneTemplate"("organizationId", "family", "code");

-- CreateIndex
CREATE INDEX "Milestone_projectId_templateCode_idx" ON "Milestone"("projectId", "templateCode");
