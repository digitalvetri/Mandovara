-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('ACTIVE', 'KEPT', 'MISSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "doNotChase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastContactedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PromiseToPay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "promisedDate" DATE NOT NULL,
    "note" TEXT,
    "status" "PromiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromiseToPay_organizationId_clientId_status_idx" ON "PromiseToPay"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "PromiseToPay_organizationId_promisedDate_status_idx" ON "PromiseToPay"("organizationId", "promisedDate", "status");

-- CreateIndex
CREATE INDEX "Client_organizationId_doNotChase_lastContactedAt_idx" ON "Client"("organizationId", "doNotChase", "lastContactedAt");

-- CreateIndex
CREATE INDEX "Expense_organizationId_approvalState_paidAt_idx" ON "Expense"("organizationId", "approvalState", "paidAt");

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
