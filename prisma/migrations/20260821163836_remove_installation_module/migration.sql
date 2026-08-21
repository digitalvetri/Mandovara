-- Remove the whole installation module — UI, service and DB layer.
--
-- Owner-approved scope (see PR description): drop the InstallVisit / InstallLine /
-- InstallCrew / InstallVisitEvent / Snag tables, their enums (InstallStatus,
-- SnagStatus, VisitKind), and the INSTALLATION / SNAGGING project stages,
-- READY_TO_INSTALL / INSTALLING order statuses, INSTALLER role. Also drops the
-- installedQty and promisedInstallAt columns on Order / OrderLine.
--
-- Existing data on removed enum values / removed rows is remapped rather than
-- deleted, so no cross-module referential damage:
--   * Project.stage INSTALLATION / SNAGGING → MAKE
--   * Order.status READY_TO_INSTALL / INSTALLING → MAKE
--   * User.role INSTALLER → STORE (installers become store keepers for the
--     purpose of preserving their identity; org admins can adjust)
--   * CalendarEvent.kind INSTALLATION → MEETING (fallback bucket)
--
-- Once every row uses only the retained enum values, the enum swap succeeds.

-- ── 0. Remap existing rows so the enum narrowing doesn't fail ────────────────
UPDATE "Project" SET stage = 'MAKE' WHERE stage IN ('INSTALLATION', 'SNAGGING');
UPDATE "Order"   SET status = 'MAKE' WHERE status IN ('READY_TO_INSTALL', 'INSTALLING');
UPDATE "User"    SET role   = 'STORE' WHERE role = 'INSTALLER';
UPDATE "CalendarEvent" SET kind = 'MEETING' WHERE kind = 'INSTALLATION';

-- ── 1. Drop FK constraints on the install tables so they can be dropped ─────
ALTER TABLE "InstallLine"        DROP CONSTRAINT IF EXISTS "InstallLine_installVisitId_fkey";
ALTER TABLE "InstallVisit"       DROP CONSTRAINT IF EXISTS "InstallVisit_projectId_fkey";
ALTER TABLE "InstallVisitEvent"  DROP CONSTRAINT IF EXISTS "InstallVisitEvent_visitId_fkey";
ALTER TABLE "Snag"               DROP CONSTRAINT IF EXISTS "Snag_installVisitId_fkey";
ALTER TABLE "Snag"               DROP CONSTRAINT IF EXISTS "Snag_projectId_fkey";

-- ── 2. Drop columns on Order / OrderLine ─────────────────────────────────────
ALTER TABLE "Order"     DROP COLUMN IF EXISTS "promisedInstallAt";
ALTER TABLE "OrderLine" DROP COLUMN IF EXISTS "installedQty";

-- ── 3. Drop install-domain tables ────────────────────────────────────────────
DROP TABLE IF EXISTS "InstallVisitEvent";
DROP TABLE IF EXISTS "Snag";
DROP TABLE IF EXISTS "InstallLine";
DROP TABLE IF EXISTS "InstallVisit";
DROP TABLE IF EXISTS "InstallCrew";

-- ── 4. Enum narrowing ────────────────────────────────────────────────────────
-- AppRole: drop INSTALLER
BEGIN;
CREATE TYPE "AppRole_new" AS ENUM ('OWNER', 'DESIGNER', 'SALES', 'MEASURE_EXEC', 'STORE', 'MAKE_SUPERVISOR', 'ACCOUNTS', 'HR');
ALTER TABLE "User"      ALTER COLUMN "role" TYPE "AppRole_new" USING ("role"::text::"AppRole_new");
ALTER TABLE "SavedView" ALTER COLUMN "role" TYPE "AppRole_new" USING ("role"::text::"AppRole_new");
ALTER TYPE "AppRole" RENAME TO "AppRole_old";
ALTER TYPE "AppRole_new" RENAME TO "AppRole";
DROP TYPE "AppRole_old";
COMMIT;

-- EventKind: drop INSTALLATION
BEGIN;
CREATE TYPE "EventKind_new" AS ENUM ('SITE_VISIT', 'FOLLOW_UP', 'MEETING', 'DEADLINE', 'LEAVE', 'HOLIDAY');
ALTER TABLE "CalendarEvent" ALTER COLUMN "kind" TYPE "EventKind_new" USING ("kind"::text::"EventKind_new");
ALTER TYPE "EventKind" RENAME TO "EventKind_old";
ALTER TYPE "EventKind_new" RENAME TO "EventKind";
DROP TYPE "EventKind_old";
COMMIT;

-- OrderStatus: drop READY_TO_INSTALL, INSTALLING
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCUREMENT', 'MAKE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- ProjectStage: drop INSTALLATION, SNAGGING
BEGIN;
CREATE TYPE "ProjectStage_new" AS ENUM ('ENQUIRY', 'SITE_VISIT', 'MEASUREMENT', 'QUOTATION', 'ORDERED', 'PROCUREMENT', 'MAKE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Project" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "stage" TYPE "ProjectStage_new" USING ("stage"::text::"ProjectStage_new");
ALTER TYPE "ProjectStage" RENAME TO "ProjectStage_old";
ALTER TYPE "ProjectStage_new" RENAME TO "ProjectStage";
DROP TYPE "ProjectStage_old";
ALTER TABLE "Project" ALTER COLUMN "stage" SET DEFAULT 'ENQUIRY';
COMMIT;

-- ── 5. Drop install-only enums ───────────────────────────────────────────────
DROP TYPE IF EXISTS "InstallStatus";
DROP TYPE IF EXISTS "SnagStatus";
DROP TYPE IF EXISTS "VisitKind";
