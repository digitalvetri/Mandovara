-- Site visits and measurements are one module (2026-08-27, owner instruction).
--
-- LeadStage carried BOTH "MEASUREMENT_SCHEDULED" and "VISIT_SCHEDULED" —
-- two names for the same fact: someone is going to the site. The UI has
-- collapsed every pre-quote stage to "NEW" via normalizeLeadStage since
-- 25 Aug 2026, so neither value is user-visible; but the data still
-- carried both, and any future report grouping by stage would have split
-- one cohort in two.
--
-- Backfill onto VISIT_SCHEDULED, which is the broader of the two (a visit
-- may be a survey, a sample showing or a measurement — measurement is one
-- purpose of a visit, not a peer of it).
--
-- The enum VALUE is deliberately NOT dropped. Removing a value from a
-- Postgres enum requires recreating the type and rewriting every
-- dependent column, which is a large amount of risk to retire a label no
-- user can see. It stays as a tombstone; no application code writes it.
UPDATE "Lead"
   SET "stage" = 'VISIT_SCHEDULED'
 WHERE "stage" = 'MEASUREMENT_SCHEDULED';

-- Measurement rounds taken on a scheduled visit should point back at it.
-- "Measurement"."siteVisitId" has existed since the initial schema and no
-- application code had ever written it, which is the single technical
-- reason the two modules never appeared joined anywhere in the product.
-- It is populated from 2026-08-27 onward; this index is what makes the
-- visit page's "measurements on this visit" panel a lookup rather than a
-- scan.
CREATE INDEX IF NOT EXISTS "Measurement_siteVisitId_idx"
  ON "Measurement" ("siteVisitId");
