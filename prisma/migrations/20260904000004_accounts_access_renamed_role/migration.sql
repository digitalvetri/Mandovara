-- Follow-up to 20260904000003_accounts_procurement_access.
--
-- That migration finds the accounts team by `Role.name = 'Accounts'`,
-- which is what prisma/seed/roles.ts writes and what
-- kernel/people/role-name.ts looks up. It is the right match for a
-- seeded org and it is the one every install we know of has.
--
-- It is not the only shape a role can be in. A Role row can be edited
-- from Admin & Roles, and an org that renamed theirs — "Accounts &
-- Finance", "Finance" — would have been skipped silently: no error, no
-- rows, and an accounts team still unable to open Purchase or Stock.
--
-- This adds the second way of finding them: follow the users carrying
-- the legacy AppRole value 'ACCOUNTS' to whichever Role row they
-- actually point at. Written as its own file rather than by editing
-- 000003, because that migration has been applied and an applied
-- migration is history — rewriting it breaks the checksum for every
-- database that already ran it.
--
-- Same five read-only keys, same ON CONFLICT DO NOTHING, so on an org
-- where 000003 already matched this changes nothing at all.

INSERT INTO "RolePermission" ("id", "roleId", "key", "scope")
SELECT gen_random_uuid()::text, r."id", k."key", 'FULL'::"PermScope"
FROM "Role" r
CROSS JOIN (
  VALUES ('po.view'), ('requisition.view'), ('vendor.view'),
         ('inventory.view'), ('stock.view')
) AS k("key")
WHERE r."isOwnerRole" = false
  AND r."id" IN (
    SELECT u."roleId" FROM "User" u
    WHERE u."role" = 'ACCOUNTS' AND u."roleId" IS NOT NULL
  )
ON CONFLICT ("roleId", "key") DO NOTHING;
