-- A purchase order line can now name a typed item instead of a catalogued
-- colourway, for buying something the catalogue does not carry yet.
-- Mirrors PurchaseRequestLine, which has had this shape since the start.
--
-- Both changes are widening: every existing row keeps its colourwayId and
-- gets NULL for freeTextItem, so nothing needs backfilling.

ALTER TABLE "POLine" ALTER COLUMN "colourwayId" DROP NOT NULL;
ALTER TABLE "POLine" ADD COLUMN "freeTextItem" TEXT;
