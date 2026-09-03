-- The Accounts login can now reach Purchase & Vendors and Stock.
--
-- Owner instruction, 2026-09-04. The accounts team pays the vendor
-- bills and reconciles the stock value that sits on the balance sheet,
-- but the Accounts role held neither `po.view` nor `inventory.view`, so
-- both modules answered 403 and the sidebar showed no way in. They were
-- being asked to sign off on numbers they were not allowed to look at.
--
-- What this grants, and nothing more:
--   po.view          → /purchase (PO list, PO detail, vendor payables)
--   requisition.view → /purchase/requests
--   vendor.view      → /purchase/vendors
--   inventory.view   → /inventory and /inventory/pending
--   stock.view       → stock balances behind those pages
--
-- Every key is READ-only. Accounts still cannot raise a PO, receive a
-- GRN, adjust a quantity or record a counter sale — those need
-- po.create / grn.create / inventory.adjust, which are not touched here
-- and stay with Store.
--
-- Scope of these statements:
--   · inserts ONLY into RolePermission, ONLY for roles named 'Accounts'
--   · ON CONFLICT DO NOTHING, so re-running changes nothing and an org
--     that already granted a key by hand keeps its existing scope
--   · owner accounts are unaffected — Role.isOwnerRole short-circuits to
--     allPermissions() in session.ts and never reads these rows
--
-- prisma/seed/roles.ts carries the same five keys so a fresh install and
-- an upgraded one end up identical. Reversible by hand: DELETE the rows,
-- or revoke from Admin & Roles.

INSERT INTO "RolePermission" ("id", "roleId", "key", "scope")
SELECT gen_random_uuid()::text, r."id", k."key", 'FULL'::"PermScope"
FROM "Role" r
CROSS JOIN (
  VALUES ('po.view'), ('requisition.view'), ('vendor.view'),
         ('inventory.view'), ('stock.view')
) AS k("key")
WHERE r."name" = 'Accounts'
  AND r."isOwnerRole" = false
ON CONFLICT ("roleId", "key") DO NOTHING;
