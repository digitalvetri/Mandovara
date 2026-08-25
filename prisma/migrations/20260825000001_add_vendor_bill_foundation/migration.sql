-- §Vendor Bill Foundation
--
-- Adds the schema layer for the three-way match (PO → GRN → VendorBill):
--   * VendorBillStatus enum
--   * POLine.gstRate — captures vendor GST rate per line for input credit
--   * VendorBill — financial liability raised against a GRN/PO
--   * VendorBillLine — line-level breakdown with GST computation columns
--   * PaymentAllocation.vendorBillId — links outbound payments to vendor bills
--
-- No UI or business logic is changed in this migration.
-- RLS is applied to both new tables following §3.2 (deny-by-default).

-- ─── Enum ───────────────────────────────────────────────────────────────────

CREATE TYPE "VendorBillStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED'
);

-- ─── POLine.gstRate ─────────────────────────────────────────────────────────
-- Default 0 so existing rows remain valid (0% = exempt / not yet classified).

ALTER TABLE "POLine" ADD COLUMN "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- ─── VendorBill ─────────────────────────────────────────────────────────────

CREATE TABLE "VendorBill" (
    "id"                TEXT                NOT NULL,
    "organizationId"    TEXT                NOT NULL,
    "number"            TEXT                NOT NULL,
    "vendorId"          TEXT                NOT NULL,
    "purchaseOrderId"   TEXT,
    "grnId"             TEXT,
    "vendorInvoiceNo"   TEXT,
    "vendorInvoiceDate" TIMESTAMP(3),
    "billDate"          TIMESTAMP(3)        NOT NULL,
    "status"            "VendorBillStatus"  NOT NULL DEFAULT 'DRAFT',
    "taxableAmount"     BIGINT              NOT NULL,
    "cgst"              BIGINT              NOT NULL DEFAULT 0,
    "sgst"              BIGINT              NOT NULL DEFAULT 0,
    "igst"              BIGINT              NOT NULL DEFAULT 0,
    "roundOff"          BIGINT              NOT NULL DEFAULT 0,
    "total"             BIGINT              NOT NULL,
    "vendorGstin"       TEXT,
    "placeOfSupply"     TEXT,
    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VendorBill"
    ADD CONSTRAINT "VendorBill_grnId_fkey"
    FOREIGN KEY ("grnId") REFERENCES "GRN"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "VendorBill_organizationId_number_key"
    ON "VendorBill"("organizationId", "number");
CREATE INDEX "VendorBill_organizationId_vendorId_status_idx"
    ON "VendorBill"("organizationId", "vendorId", "status");
CREATE INDEX "VendorBill_organizationId_purchaseOrderId_idx"
    ON "VendorBill"("organizationId", "purchaseOrderId");

-- ─── VendorBillLine ─────────────────────────────────────────────────────────

CREATE TABLE "VendorBillLine" (
    "id"             TEXT              NOT NULL,
    "organizationId" TEXT              NOT NULL,
    "vendorBillId"   TEXT              NOT NULL,
    "lineNo"         INTEGER           NOT NULL,
    "colourwayId"    TEXT,
    "description"    TEXT              NOT NULL,
    "hsn"            TEXT,
    "quantity"       DECIMAL(12,3)     NOT NULL,
    "unit"           "SellUnit"        NOT NULL,
    "rate"           BIGINT            NOT NULL,
    "gstRate"        DECIMAL(5,2)      NOT NULL DEFAULT 0,
    "taxable"        BIGINT            NOT NULL,
    "cgst"           BIGINT            NOT NULL DEFAULT 0,
    "sgst"           BIGINT            NOT NULL DEFAULT 0,
    "igst"           BIGINT            NOT NULL DEFAULT 0,
    "amount"         BIGINT            NOT NULL,
    CONSTRAINT "VendorBillLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VendorBillLine"
    ADD CONSTRAINT "VendorBillLine_vendorBillId_fkey"
    FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── PaymentAllocation.vendorBillId ─────────────────────────────────────────

ALTER TABLE "PaymentAllocation" ADD COLUMN "vendorBillId" TEXT;

ALTER TABLE "PaymentAllocation"
    ADD CONSTRAINT "PaymentAllocation_vendorBillId_fkey"
    FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentAllocation_vendorBillId_idx"
    ON "PaymentAllocation"("vendorBillId");

-- ─── Row-Level Security §3.2 ─────────────────────────────────────────────────

ALTER TABLE "VendorBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VendorBill" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "VendorBill";
CREATE POLICY org_isolation ON "VendorBill"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

ALTER TABLE "VendorBillLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VendorBillLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "VendorBillLine";
CREATE POLICY org_isolation ON "VendorBillLine"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());
