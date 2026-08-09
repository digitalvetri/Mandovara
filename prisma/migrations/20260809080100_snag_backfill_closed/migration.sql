-- §5.2 alignment step 2 of 2 — backfill VERIFIED rows to CLOSED.
-- Split from the enum-add migration because Postgres refuses to USE
-- a newly added enum value in the same transaction. Idempotent.

UPDATE "SnagItem" SET "status" = 'CLOSED' WHERE "status" = 'VERIFIED';
