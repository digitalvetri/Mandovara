-- CreateEnum
CREATE TYPE "MeasurementFamily" AS ENUM ('WALLPAPER', 'FLOORING', 'CURTAIN');

-- Prisma's generator wanted to drop the three GIN indexes on Product
-- because they were added by raw SQL in 20260802135000_search_and_immutability
-- and are not present in schema.prisma (searchVector uses Unsupported<>,
-- specs is JSONB, code has trgm — none of which Prisma can express).
-- Keeping them: catalog search p95 < 200ms depends on the GIN indexes.
-- DO NOT drop.

-- CreateTable
CREATE TABLE "MeasurementItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomLabel" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "family" "MeasurementFamily" NOT NULL,
    "inputs" JSONB NOT NULL,
    "photoKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "MeasurementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalcResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "measurementItemId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "family" "MeasurementFamily" NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "warnings" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalcResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeasurementItem_orgId_projectId_idx" ON "MeasurementItem"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "MeasurementItem_orgId_family_idx" ON "MeasurementItem"("orgId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "CalcResult_measurementItemId_key" ON "CalcResult"("measurementItemId");

-- CreateIndex
CREATE INDEX "CalcResult_orgId_family_idx" ON "CalcResult"("orgId", "family");

-- AddForeignKey
ALTER TABLE "MeasurementItem" ADD CONSTRAINT "MeasurementItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcResult" ADD CONSTRAINT "CalcResult_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
