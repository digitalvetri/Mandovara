-- Catalogue lending — reuse the sample-library ledger rather than build a second one.
--
-- /samples already implements issue / return / overdue against SampleBook +
-- SampleIssue, but SampleBook could only describe a barcoded supplier book
-- hanging off a Collection. The studio's own shelf is the Catalogue list, and
-- that is the list the owner actually lends from.
--
-- So a SampleBook now points at EITHER a Collection or a Catalogue, and
-- SampleIssue — the ledger — is untouched. One table still records every loan
-- of every book (CLAUDE.md #14: no duplicate business systems).

-- 1. collectionId becomes optional; a catalogue-backed book has none.
ALTER TABLE "SampleBook" ALTER COLUMN "collectionId" DROP NOT NULL;

-- 2. costValue is meaningless for a studio catalogue — default it rather than
--    forcing every insert to pass a zero.
ALTER TABLE "SampleBook" ALTER COLUMN "costValue" SET DEFAULT 0;

-- 3. The new side of the union.
ALTER TABLE "SampleBook" ADD COLUMN "catalogueId" TEXT;

-- One lendable book per catalogue: the physical object is the catalogue.
CREATE UNIQUE INDEX "SampleBook_catalogueId_key" ON "SampleBook"("catalogueId");
CREATE INDEX "SampleBook_organizationId_status_idx" ON "SampleBook"("organizationId", "status");

ALTER TABLE "SampleBook"
  ADD CONSTRAINT "SampleBook_catalogueId_fkey"
  FOREIGN KEY ("catalogueId") REFERENCES "Catalogue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one shelf. Enforced here, not just in the application, because a
-- book belonging to both a Collection and a Catalogue has no meaning and the
-- lending UI would have to guess which name to print.
ALTER TABLE "SampleBook"
  ADD CONSTRAINT "SampleBook_one_source"
  CHECK (num_nonnulls("collectionId", "catalogueId") = 1);

-- 4. A due date is now optional. A catalogue handed to a walk-in usually has
--    no agreed return date, and forcing one made the field a lie. Overdue is
--    computed only for loans that carry one.
ALTER TABLE "SampleIssue" ALTER COLUMN "dueAt" DROP NOT NULL;

-- 5. Snapshot of the holder's name, so a returned-books list still reads
--    correctly after the client is renamed or deleted.
ALTER TABLE "SampleIssue" ADD COLUMN "holderName" TEXT;
