-- AlterEnum
ALTER TYPE "MakeJobStatus" ADD VALUE 'REWORK';

-- AlterTable
ALTER TABLE "MakeJob" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MakeJobEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "makeJobId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MakeJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakeJobEvent_makeJobId_createdAt_idx" ON "MakeJobEvent"("makeJobId", "createdAt");

-- AddForeignKey
ALTER TABLE "MakeJobEvent" ADD CONSTRAINT "MakeJobEvent_makeJobId_fkey" FOREIGN KEY ("makeJobId") REFERENCES "MakeJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
