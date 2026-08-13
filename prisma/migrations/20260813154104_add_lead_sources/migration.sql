-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'FACEBOOK';
ALTER TYPE "LeadSource" ADD VALUE 'GOOGLE';
ALTER TYPE "LeadSource" ADD VALUE 'ADVERTISEMENT';

-- DropIndex
DROP INDEX "Colourway_code_trgm_idx";

-- DropIndex
DROP INDEX "Design_code_trgm_idx";

-- DropIndex
DROP INDEX "Design_searchVector_idx";

-- DropIndex
DROP INDEX "Design_specs_gin_idx";

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_colourwayId_fkey" FOREIGN KEY ("colourwayId") REFERENCES "Colourway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
