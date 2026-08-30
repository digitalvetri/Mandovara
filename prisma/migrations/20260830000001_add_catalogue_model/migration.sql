-- Catalogues become their own model — entirely separate from the
-- Brand / Collection / Design tree (2026-08-30, owner instruction:
-- "donotmix product catalog and catalog both are entirely different").
--
-- The /catalogues page held its data as Collection rows under an auto-
-- created "Catalogues" brand. That let those entries surface on
-- /products (Product Catalog) as a brand card and bleed into any
-- Collection-wide query. The new "Catalogue" table has no relation to
-- Brand, Design or Colourway — it's just a name + family per org.

CREATE TABLE "Catalogue" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "family"         "ProductFamily" NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Catalogue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Catalogue_organizationId_name_key"
  ON "Catalogue"("organizationId", "name");

CREATE INDEX "Catalogue_organizationId_family_idx"
  ON "Catalogue"("organizationId", "family");

ALTER TABLE "Catalogue" ADD CONSTRAINT "Catalogue_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security — every tenant-scoped table has this policy, see
-- 20260818000000_row_level_security.
ALTER TABLE "Catalogue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Catalogue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Catalogue";
CREATE POLICY org_isolation ON "Catalogue"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

-- Move any existing "Catalogues"-brand Collection rows into the new
-- table, dedupe on (org, uppercased-name), and then remove the source
-- rows so /products no longer shows the "Catalogues" brand card.
INSERT INTO "Catalogue" ("id", "organizationId", "name", "family")
SELECT
  'cat_' || substr(md5(random()::text || c."id"), 1, 24),
  c."organizationId",
  c."name",
  c."family"
FROM "Collection" c
JOIN "Brand" b ON b."id" = c."brandId"
WHERE b."name" = 'Catalogues'
ON CONFLICT ("organizationId", "name") DO NOTHING;

-- The seed loader / paste modal never wrote Designs under these
-- Collections, so a plain DELETE succeeds. If some hand-crafted Design
-- exists, the FK constraint below will throw and the migration will
-- roll back — investigate before retrying.
DELETE FROM "Collection"
WHERE "brandId" IN (SELECT "id" FROM "Brand" WHERE "name" = 'Catalogues');

DELETE FROM "Brand" WHERE "name" = 'Catalogues';
