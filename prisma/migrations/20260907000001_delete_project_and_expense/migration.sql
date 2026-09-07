-- Two new permission keys: project.delete and expense.delete.
--
-- Owner instruction, 2026-09-07: a project created against the wrong
-- client, and an expense typed with a digit too many, both had to stay
-- on the books forever — nothing in the app could remove either.
--
-- No schema change. Permission keys live in
-- src/kernel/rbac/permissions.ts and are stored per-role as
-- RolePermission rows, so the only thing to migrate is the grant for
-- existing organisations.
--
-- What this grants, and nothing more:
--   expense.delete → the trash control on a Spending row, for the
--                    Accounts role. It refuses on an expense already
--                    marked paid; see modules/expenses/actions-delete.ts.
--
-- What it deliberately does NOT grant:
--   project.delete → Owner only. isOwnerRole=true short-circuits to
--                    allPermissions() in session.ts, so the Owner has it
--                    the moment the key exists and no row is needed.
--                    Deleting a project takes rooms, measurements,
--                    milestones and draft quotations with it, and is
--                    refused outright once any invoice, receipt,
--                    payment, order or stock movement exists — that is
--                    not a decision to hand to a second role by default.
--                    Grant it from Admin & Roles if a site wants to.
--
-- Scope of this statement:
--   · inserts ONLY into RolePermission, and only for the accounts role
--   · ON CONFLICT DO NOTHING, so re-running changes nothing and an org
--     that already granted the key by hand keeps its existing scope
--   · owner accounts are unaffected (see above)
--
-- The accounts role is found two ways, the lesson of
-- 20260904000004_accounts_access_renamed_role: by `Role.name =
-- 'Accounts'`, which is what prisma/seed/roles.ts writes, AND by
-- following the users carrying the legacy AppRole value 'ACCOUNTS' to
-- whichever Role row they actually point at — an org that renamed
-- theirs to "Finance" from Admin & Roles would otherwise be skipped in
-- silence.
--
-- prisma/seed/roles.ts carries the same key so a fresh install and an
-- upgraded one end up identical. Reversible by hand: DELETE the rows,
-- or revoke from Admin & Roles.

INSERT INTO "RolePermission" ("id", "roleId", "key", "scope")
SELECT gen_random_uuid()::text, r."id", 'expense.delete', 'FULL'::"PermScope"
FROM "Role" r
WHERE r."isOwnerRole" = false
  AND (
    r."name" = 'Accounts'
    OR r."id" IN (
      SELECT u."roleId" FROM "User" u
      WHERE u."role" = 'ACCOUNTS' AND u."roleId" IS NOT NULL
    )
  )
ON CONFLICT ("roleId", "key") DO NOTHING;
