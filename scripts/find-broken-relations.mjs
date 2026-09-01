// Find the rows that crash a page instead of degrading it.
//
// Every org-owned table carries the RLS policy `"organizationId" =
// current_org_id()`. A child row sitting in a DIFFERENT organization
// from its parent is therefore invisible to the app while the parent
// stays visible. Prisma treats these relations as REQUIRED, so a query
// that nests one does not return null — it throws:
//
//   Inconsistent query result: Field room is required to return data,
//   got `null` instead.
//
// which surfaces as "Something went wrong" on the whole page. That is
// what took the quotations list down, and the project detail page runs
// the same shape through room and design → collection → brand.
//
// Run against production with the OWNER connection (DATABASE_URL), not
// the app role — the app role cannot see the mismatch by definition:
//
//   node scripts/find-broken-relations.mjs
//
// Inside the Coolify container:
//
//   node /app/scripts/find-broken-relations.mjs
//
// Zero rows everywhere means the code-side guards are defence in depth.
// Any rows are the actual trigger, and each one takes down every page
// that reads the affected record.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Each check: a child whose parent is either missing outright or sits in
// another organization. Both are invisible to the app in the same way.
const CHECKS = [
  {
    name:  "MeasurementItem → Room",
    hurts: "project detail, measurement round",
    sql: `SELECT i.id AS child_id, i.label AS child_label, i."roomId" AS parent_id,
                 i."organizationId" AS child_org, r."organizationId" AS parent_org
            FROM "MeasurementItem" i
            LEFT JOIN "Room" r ON r.id = i."roomId"
           WHERE r.id IS NULL OR r."organizationId" <> i."organizationId"`,
  },
  {
    name:  "Colourway → Design",
    hurts: "project detail, quotations, catalogue",
    sql: `SELECT c.id AS child_id, c.code AS child_label, c."designId" AS parent_id,
                 c."organizationId" AS child_org, d."organizationId" AS parent_org
            FROM "Colourway" c
            LEFT JOIN "Design" d ON d.id = c."designId"
           WHERE d.id IS NULL OR d."organizationId" <> c."organizationId"`,
  },
  {
    name:  "Design → Collection",
    hurts: "project detail, catalogue, search",
    sql: `SELECT d.id AS child_id, d.name AS child_label, d."collectionId" AS parent_id,
                 d."organizationId" AS child_org, col."organizationId" AS parent_org
            FROM "Design" d
            LEFT JOIN "Collection" col ON col.id = d."collectionId"
           WHERE col.id IS NULL OR col."organizationId" <> d."organizationId"`,
  },
  {
    name:  "Collection → Brand",
    hurts: "project detail, catalogue, stock",
    sql: `SELECT col.id AS child_id, col.name AS child_label, col."brandId" AS parent_id,
                 col."organizationId" AS child_org, b."organizationId" AS parent_org
            FROM "Collection" col
            LEFT JOIN "Brand" b ON b.id = col."brandId"
           WHERE b.id IS NULL OR b."organizationId" <> col."organizationId"`,
  },
  {
    name:  "Project → Client",
    hurts: "projects, quotations, orders, stock, search, dashboard",
    sql: `SELECT p.id AS child_id, p.name AS child_label, p."clientId" AS parent_id,
                 p."organizationId" AS child_org, c."organizationId" AS parent_org
            FROM "Project" p
            LEFT JOIN "Client" c ON c.id = p."clientId"
           WHERE c.id IS NULL OR c."organizationId" <> p."organizationId"`,
  },
  {
    name:  "MeasurementItem → Measurement",
    hurts: "measurement edit and sync",
    sql: `SELECT i.id AS child_id, i.label AS child_label, i."measurementId" AS parent_id,
                 i."organizationId" AS child_org, m."organizationId" AS parent_org
            FROM "MeasurementItem" i
            LEFT JOIN "Measurement" m ON m.id = i."measurementId"
           WHERE m.id IS NULL OR m."organizationId" <> i."organizationId"`,
  },
];

let broken = 0;

for (const check of CHECKS) {
  const rows = await prisma.$queryRawUnsafe(check.sql);
  if (rows.length === 0) {
    console.log(`✓ ${check.name} — clean`);
    continue;
  }
  broken += rows.length;
  console.log(`\n✗ ${check.name} — ${rows.length} broken row(s)`);
  console.log(`  breaks: ${check.hurts}`);
  for (const r of rows.slice(0, 20)) {
    const why = r.parent_org == null ? "parent row missing" : `parent in org ${r.parent_org}`;
    console.log(`    ${r.child_id}  ${r.child_label ?? ""}  →  ${r.parent_id}  (${why}, child org ${r.child_org})`);
  }
  if (rows.length > 20) console.log(`    … and ${rows.length - 20} more`);
}

console.log(
  broken === 0
    ? "\nNothing broken. The code-side guards are defence in depth."
    : `\n${broken} row(s) will crash a page rather than degrade it. Repair each by moving the parent into the child's organization, or by pointing the child at a parent it can actually see.`,
);

await prisma.$disconnect();
