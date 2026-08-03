-- Wipe transactional data. Preserves master data so the app stays usable.
--
-- PRESERVED (masters):
--   Organization, Branch, Role, RolePermission, User, UserRole,
--   Warehouse, Rack, Bin, Employee, Vendor, StatutorySlab,
--   MessageTemplate, SalaryStructure, SalaryComponent,
--   Setting, Sequence, _prisma_migrations
--
-- WIPED (transactional): everything else.

DO $$
DECLARE
  r record;
  preserved_names text[] := ARRAY[
    'Organization', 'Branch', 'Role', 'RolePermission',
    'User', 'UserRole',
    'Warehouse', 'Rack', 'Bin',
    'Employee', 'Vendor', 'VendorAddress', 'VendorContact',
    'StatutorySlab',
    'SalaryStructure', 'SalaryComponent',
    'MessageTemplate',
    'Setting', 'Sequence',
    '_prisma_migrations'
  ];
  wipe_names text[] := ARRAY[]::text[];
BEGIN
  ALTER TABLE "AuditLog"         DISABLE TRIGGER USER;
  ALTER TABLE "StockLedgerEntry" DISABLE TRIGGER USER;

  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL(preserved_names)
      AND left(tablename, 1) <> '_'
  LOOP
    wipe_names := array_append(wipe_names, r.tablename);
  END LOOP;

  IF array_length(wipe_names, 1) > 0 THEN
    EXECUTE 'TRUNCATE TABLE ' ||
      (SELECT string_agg(format('%I', t), ', ') FROM unnest(wipe_names) AS t) ||
      ' RESTART IDENTITY CASCADE';
  END IF;

  ALTER TABLE "AuditLog"         ENABLE TRIGGER USER;
  ALTER TABLE "StockLedgerEntry" ENABLE TRIGGER USER;

  RAISE NOTICE 'Wiped % transactional tables', COALESCE(array_length(wipe_names, 1), 0);
END $$;
