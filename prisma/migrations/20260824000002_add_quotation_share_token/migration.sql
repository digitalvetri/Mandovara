-- AlterTable: add public share token fields to Quotation
ALTER TABLE "Quotation" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "shareTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_shareToken_key" ON "Quotation"("shareToken");
