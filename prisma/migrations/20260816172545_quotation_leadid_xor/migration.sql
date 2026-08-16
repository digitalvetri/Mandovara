-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_projectId_fkey";

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Quotation_organizationId_leadId_idx" ON "Quotation"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_clientId_idx" ON "Quotation"("organizationId", "clientId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- XOR constraint: a quotation belongs to EITHER a lead or a client, never both.
-- FIXES-01 §5.1. Prisma does not model CHECK constraints so added manually here.
-- Existing rows all have clientId NOT NULL, leadId NULL → passes ((0+1)=1). No backfill needed.
ALTER TABLE "Quotation" ADD CONSTRAINT "quotation_party_xor"
  CHECK ((("leadId" IS NOT NULL)::int + ("clientId" IS NOT NULL)::int) = 1);
