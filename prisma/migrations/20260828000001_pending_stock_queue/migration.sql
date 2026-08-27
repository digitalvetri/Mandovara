-- Pending stock verification becomes a working queue (2026-08-28,
-- owner instruction: "make it a working queue we can tick off").
--
-- It was a static JSON file rendered read-only. Staff could see the 25
-- unidentified items but could not record having checked one, so the
-- list stayed at 25 forever and the answer they found on the label —
-- the only thing that lets someone create the catalogue entry
-- afterwards — was never written down anywhere.
--
-- The JSON stays in the repo as the origin of this data; from here the
-- table is the truth.
--
-- These rows are still NOT stock. Nothing here reaches StockBalance or
-- any KPI until a human confirms what the label says.

CREATE TYPE "PendingStockStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISCARDED');

CREATE TABLE "PendingStockItem" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "sourceId"        TEXT NOT NULL,
  "groupKey"        TEXT NOT NULL,
  "groupLabel"      TEXT NOT NULL,
  "source"          TEXT NOT NULL,
  "catalogueName"   TEXT,
  "code"            TEXT NOT NULL,
  "qty"             DECIMAL(12,3) NOT NULL,
  "unit"            TEXT NOT NULL,
  "lengthInches"    DECIMAL(8,2),
  "confirmNeeded"   TEXT NOT NULL,
  "status"          "PendingStockStatus" NOT NULL DEFAULT 'PENDING',
  "foundBrand"      TEXT,
  "foundCollection" TEXT,
  "note"            TEXT,
  "verifiedById"    TEXT,
  "verifiedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingStockItem_pkey" PRIMARY KEY ("id")
);

-- Keyed on the SOURCE id, not the code.
--
-- Three bespoke rolls in the "Project / bespoke stock" group share the
-- placeholder code "— (no code)" — they are different physical rolls
-- (dark grey, sandel, light grey) that simply have nothing printed on
-- them. Keying on code silently collapsed all three into one and lost
-- two real rolls. The source id is the natural key and makes re-seeding
-- genuinely idempotent.
CREATE UNIQUE INDEX "PendingStockItem_org_source_key"
  ON "PendingStockItem" ("organizationId", "sourceId");
CREATE INDEX "PendingStockItem_org_status_idx"
  ON "PendingStockItem" ("organizationId", "status");

-- Seed the backlog for every organisation that exists. The primary key is
-- derived per-org so two orgs cannot collide on the JSON's ids.
INSERT INTO "PendingStockItem" (
  "id", "organizationId", "sourceId", "groupKey", "groupLabel", "source",
  "catalogueName", "code", "qty", "unit", "lengthInches", "confirmNeeded"
)
SELECT
  substr(md5(o.id || v.src_id), 1, 24),
  o.id, v.src_id,
  v.group_key, v.group_label, v.source,
  v.catalogue_name, v.code, v.qty, v.unit, v.length_inches, v.confirm_needed
FROM "Organization" o
CROSS JOIN (VALUES
  ('A-FAITH-F7047', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'FAITH', 'F7047', 6, 'ROLL', NULL, 'Brand name on selvedge · full collection name · roll width · pattern repeat'),
  ('A-FAITH-F7016', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'FAITH', 'F7016', 1, 'ROLL', NULL, 'Brand name on selvedge · full collection name'),
  ('A-FAITH-F7057', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'FAITH', 'F7057', 1, 'ROLL', NULL, 'Brand name on selvedge · full collection name'),
  ('A-MODELICA-AMDL211122', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'MODELICA', 'AMDL211122', 3, 'ROLL', NULL, 'Brand name on selvedge · whether AMDL is the brand code or a design-line prefix'),
  ('A-MODELICA-AMDL211125', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'MODELICA', 'AMDL211125', 3, 'ROLL', NULL, 'Brand name on selvedge'),
  ('A-FF-HOR809', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'F&F', 'HOR809', 2, 'ROLL', NULL, 'Full brand name · whether HOR809 and DE214102 are from the same collection'),
  ('A-FF-DE214102', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'F&F', 'DE214102', 1, 'ROLL', NULL, 'Full brand name · collection name'),
  ('A-OKHILLA-RD3137', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'OKHILLA', 'RD3137', 1, 'ROLL', NULL, 'Brand name on selvedge · full collection name · roll width'),
  ('A-PASSENGER-TP21202', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'PASSENGER', 'TP21202', 3, 'ROLL', NULL, 'Brand name on selvedge · full collection name'),
  ('A-BEYOND-72008-4', 'mandovara-named', 'Named — no catalogue match', 'MANDOVARA STOCK', 'BEYOND', '72008-4', 1, 'ROLL', NULL, 'Brand name on selvedge · whether this is a Latest Wallpaper / Arham product'),
  ('B-TN83405', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, 'TN83405', 1, 'ROLL', NULL, 'Brand name · collection name · roll width · pattern repeat from roll label'),
  ('B-NO0044', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, 'NO:0044', 1, 'ROLL', NULL, 'Brand name · collection name from roll label'),
  ('B-EAR301', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, 'EAR301', 1, 'ROLL', NULL, 'Brand name · collection name from roll label'),
  ('B-AD138303', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, 'AD138303', 1, 'ROLL', NULL, 'Brand name · collection name from roll label'),
  ('B-386508', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, '386-508-47823', 1, 'ROLL', NULL, 'Check if this is a barcode or design code; scan roll label for brand name and design code'),
  ('B-8603-2', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, '8603-2', 1, 'ROLL', NULL, 'Check selvedge for ''Latest Wallpaper'' or ''Brahmos'' brand print; note the exact design code'),
  ('B-7252-1', 'mandovara-unknown', 'Unknown catalogue', 'MANDOVARA STOCK', NULL, '7252-1', 1, 'ROLL', NULL, 'Check selvedge for ''Latest Wallpaper'' or ''Brahmos'' brand print; note the exact design code'),
  ('SB-GREY-DARK', 'mandovara-bespoke', 'Project / bespoke stock', 'MANDOVARA STOCK', NULL, '— (no code)', 1, 'ROLL', NULL, 'Check if this matches an existing catalogue colourway (e.g. a plain grey wallpaper); if not, write off or assign to a project'),
  ('SB-SANDEL', 'mandovara-bespoke', 'Project / bespoke stock', 'MANDOVARA STOCK', NULL, '— (no code)', 1, 'ROLL', NULL, 'Check if this matches an existing catalogue colourway; assign to project or write off'),
  ('SB-GREY-LIGHT', 'mandovara-bespoke', 'Project / bespoke stock', 'MANDOVARA STOCK', NULL, '— (no code)', 1, 'ROLL', NULL, 'Check if this matches an existing catalogue colourway; assign to project or write off'),
  ('SC-AL259719-A', 'mandovara-bespoke', 'Project / bespoke stock', 'MANDOVARA STOCK', 'AL259719-A', 'AL259719-A', 1, 'ROLL', NULL, 'Identify which client project this was made for; add as an Install Line or project material, not a stock SKU'),
  ('SC-AL276246-A', 'mandovara-bespoke', 'Project / bespoke stock', 'MANDOVARA STOCK', 'AL276246-A', 'AL276246-A', 1, 'ROLL', NULL, 'Identify which client project this was made for; add as an Install Line or project material, not a stock SKU'),
  ('T-PLYWOOD', 'track-hardware', 'Hardware — family unconfirmed', 'TRACK STOCK', 'PLYWOOD', 'PLYWOOD', 2, 'PIECE', NULL, 'Confirm: are these boards tracked as stock or expensed during installation? If stock → assign to HARDWARE_TRACK. If expensed → log as ProjectExpense, no stock import.'),
  ('T-ANTICRAFF-32', 'track-hardware', 'Hardware — family unconfirmed', 'TRACK STOCK', 'ANTICRAFF', 'ANTICRAFF-32IN', 1, 'PIECE', 32, 'Check the physical item: if it is a channel/rail → HARDWARE_TRACK (Curtain Tracks). If it is a pole/rod → HARDWARE_ROD (Curtain Rods). Note the brand name if printed.'),
  ('T-ANTICRAFF-33', 'track-hardware', 'Hardware — family unconfirmed', 'TRACK STOCK', 'ANTICRAFF', 'ANTICRAFF-33IN', 1, 'PIECE', 33, 'Same as ANTICRAFF-32IN above')
) AS v(src_id, group_key, group_label, source, catalogue_name, code, qty, unit, length_inches, confirm_needed)
ON CONFLICT DO NOTHING;

-- Row-level security, same as every other org-owned table (§3.2).
--
-- Not optional and not an afterthought: the isolation suite asserts that
-- EVERY org-owned table has RLS enabled AND forced, and it failed the
-- moment this table appeared without it. Without these four lines one
-- tenant could read another's unverified stock.
ALTER TABLE "PendingStockItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingStockItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "PendingStockItem";
CREATE POLICY org_isolation ON "PendingStockItem"
  USING       ("organizationId" = current_org_id())
  WITH CHECK  ("organizationId" = current_org_id());

-- The restricted app role needs table grants, but it may not exist yet:
-- on a fresh database, scripts/setup-app-role.mjs runs AFTER
-- `migrate deploy` (see .github/workflows/ci.yml — the grants have to
-- cover tables the migrations just created). An unconditional GRANT here
-- therefore fails the whole migration step on any clean install, which
-- is exactly what CI caught.
--
-- Guarded, so it is a no-op on a fresh database and correct on an
-- existing one where the role is already present. setup-app-role.mjs
-- grants it either way afterwards.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mandovara_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PendingStockItem" TO mandovara_app;
  END IF;
END $$;
