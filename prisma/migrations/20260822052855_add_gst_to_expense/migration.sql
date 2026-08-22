-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "billRef" TEXT,
ADD COLUMN     "cgst" BIGINT,
ADD COLUMN     "gstRatePct" DECIMAL(5,2),
ADD COLUMN     "igst" BIGINT,
ADD COLUMN     "sgst" BIGINT,
ADD COLUMN     "taxable" BIGINT,
ADD COLUMN     "vendorGstin" TEXT;
