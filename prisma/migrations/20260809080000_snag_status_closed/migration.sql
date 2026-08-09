-- §5.2 alignment step 1 of 2 — add SnagStatus.CLOSED. Postgres
-- refuses to USE a newly added enum value in the same transaction,
-- so the row backfill lives in the next migration
-- (20260809080100_snag_backfill_closed). VERIFIED stays in the enum
-- for now; removal is a swap-enum dance for later.

-- Enum extension.
ALTER TYPE "SnagStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- §5.2 SnagItem fields (raised/assigned/resolved metadata). These
-- don't touch the enum so they can share this migration.
ALTER TABLE "SnagItem"
  ADD COLUMN "raisedById"      TEXT,
  ADD COLUMN "raisedAt"        TIMESTAMP(3),
  ADD COLUMN "assignedToId"    TEXT,
  ADD COLUMN "resolvedAt"      TIMESTAMP(3),
  ADD COLUMN "resolutionNote"  TEXT;

UPDATE "SnagItem" SET "raisedAt" = "createdAt" WHERE "raisedAt" IS NULL;
