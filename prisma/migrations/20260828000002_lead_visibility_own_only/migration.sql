-- Leads are visible only to the employee they are assigned to.
--
-- `lead.viewOthers` has been in the permission catalogue since the RBAC
-- module was written, and prisma/seed/roles.ts granted it to SALES and
-- DESIGNER — but no query ever read it, so every employee holding
-- `lead.view` saw the entire pipeline. The read side is now enforced in
-- src/modules/leads/scope.ts.
--
-- Enforcement alone does not change anything for an existing install:
-- permissions are read from RolePermission rows, so orgs seeded before
-- today still carry the grant and their Sales/Designer users would keep
-- full visibility. This revokes it, per the owner's instruction
-- (2026-08-28) that only the Owner sees every lead.
--
-- Scope of this statement:
--   · deletes ONLY rows whose key = 'lead.viewOthers'
--   · leaves every other permission, role, user and lead untouched
--   · does not touch owner accounts — Role.isOwnerRole short-circuits to
--     allPermissions() in session.ts and never consults these rows
--
-- Reversible by hand: re-insert the row for the role that needs it, or
-- grant it from Admin & Roles, which is the supported way to give a
-- manager back full pipeline visibility.

DELETE FROM "RolePermission"
WHERE "key" = 'lead.viewOthers'
  AND "roleId" IN (SELECT "id" FROM "Role" WHERE "isOwnerRole" = false);
