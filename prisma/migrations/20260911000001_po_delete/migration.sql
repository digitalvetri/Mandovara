-- New permission key: po.delete.
--
-- Owner instruction, 2026-09-11: a purchase order typed against the
-- wrong vendor or item had to stay on the books forever — nothing in
-- the app could remove one. Same shape as
-- 20260907000001_delete_project_and_expense.
--
-- No schema change. po.delete → the trash control on a Purchase Order
-- row, for the Store role (the role that raises POs in the first
-- place — po.create/grn.create already live there). It refuses once a
-- GRN, a vendor bill or the auto-created vendor-payment expense exists
-- against the PO; see modules/purchase/actions-delete.ts.
--
-- Owner is unaffected: isOwnerRole=true short-circuits to
-- allPermissions() in session.ts, so the Owner has this the moment the
-- key exists and no row is needed.
--
-- Scope of this statement:
--   · inserts ONLY into RolePermission, and only for the Store role
--   · ON CONFLICT DO NOTHING, so re-running changes nothing
--
-- The Store role is found two ways, same lesson as
-- 20260904000004_accounts_access_renamed_role: by `Role.name =
-- 'Store'`, which is what prisma/seed/roles.ts writes, AND by
-- following the users carrying the legacy AppRole value 'STORE' to
-- whichever Role row they actually point at.
--
-- prisma/seed/roles.ts carries the same key so a fresh install and an
-- upgraded one end up identical. Reversible by hand: DELETE the rows,
-- or revoke from Admin & Roles.

INSERT INTO "RolePermission" ("id", "roleId", "key", "scope")
SELECT gen_random_uuid()::text, r."id", 'po.delete', 'FULL'::"PermScope"
FROM "Role" r
WHERE r."isOwnerRole" = false
  AND (
    r."name" = 'Store'
    OR r."id" IN (
      SELECT u."roleId" FROM "User" u
      WHERE u."role" = 'STORE' AND u."roleId" IS NOT NULL
    )
  )
ON CONFLICT ("roleId", "key") DO NOTHING;
