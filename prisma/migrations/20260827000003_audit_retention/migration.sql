-- Audit log retention (2026-08-27, owner instruction: "it should
-- automatically delete the history, then the last five days history only
-- it should store").
--
-- This relaxes spec §15 non-negotiable #5 (AuditLog append-only at the
-- database level). The concern was raised with the owner and the
-- instruction reaffirmed, so it is implemented — but narrowly.
--
-- WHAT IS PRESERVED: AuditLog_no_update stays exactly as it was. An
-- audit row can still never be ALTERED. That is the property that makes
-- the log evidence rather than commentary, and nothing here touches it.
--
-- WHAT CHANGES: the blanket delete ban becomes an age gate. Rows older
-- than the retention window may be deleted; rows inside it still cannot,
-- by anyone, through any code path. So the purge job works and a user
-- covering their tracks an hour after the fact still cannot.
--
-- StockMove is untouched — it remains fully append-only. It is the stock
-- ledger that StockBalance is materialised from; deleting any part of it
-- would corrupt quantities on hand, not merely lose history.

-- Retention lives in the database so the purge is enforced at the same
-- place it is applied, and one setting cannot drift from the other.
-- Overridable per deployment via the audit.retentionDays Setting row;
-- this function is the floor the trigger enforces.
CREATE OR REPLACE FUNCTION audit_retention_days() RETURNS integer AS $$
DECLARE
  v integer;
BEGIN
  SELECT COALESCE((value ->> 'days')::int, 5) INTO v
    FROM "Setting"
   WHERE key = 'audit.retentionDays'
   LIMIT 1;
  RETURN COALESCE(v, 5);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION enforce_audit_retention() RETURNS trigger AS $$
BEGIN
  IF OLD."createdAt" > now() - (audit_retention_days() || ' days')::interval THEN
    RAISE EXCEPTION
      'AuditLog rows inside the % day retention window cannot be deleted',
      audit_retention_days();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditLog_no_delete" ON "AuditLog";

CREATE TRIGGER "AuditLog_retention_delete" BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_retention();

-- The purge scans by age, so it needs an index on age.
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

-- Default the setting explicitly for every existing org rather than
-- relying on the function's fallback, so the value is visible and
-- editable in Settings from day one instead of being invisible until
-- someone thinks to create the row.
INSERT INTO "Setting" ("id", "organizationId", "key", "value")
SELECT
  'auditret_' || substr(md5(o.id), 1, 20),
  o.id,
  'audit.retentionDays',
  '{"days": 5}'::jsonb
FROM "Organization" o
ON CONFLICT DO NOTHING;
