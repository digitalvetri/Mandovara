// Find the rows that make a client invisible to the app.
//
// The RLS policy on every org-owned table is `"organizationId" =
// current_org_id()`. So a project whose client sits in a DIFFERENT
// organization has a client the app can never read: the project is
// visible, the client is not.
//
// Prisma treats Project.client as a REQUIRED relation, so any query that
// nests `client` under `project` does not degrade — it throws:
//
//   Inconsistent query result: Field client is required to return data,
//   got `null` instead.
//
// which surfaces as "Something went wrong" on the whole page.
//
// Run against production with the OWNER connection (DATABASE_URL), not the
// app role — the app role cannot see the mismatch by definition:
//
//   node scripts/find-cross-org-clients.mjs
//
// Zero rows means the code-side guards are defence in depth and there is
// nothing to repair. Any rows are the actual trigger, and each one takes
// down every page that lists or opens the affected project.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const mismatched = await prisma.$queryRawUnsafe(`
  SELECT p.id            AS project_id,
         p.number        AS project_number,
         p.name          AS project_name,
         p."organizationId" AS project_org,
         c.id            AS client_id,
         c.name          AS client_name,
         c."organizationId" AS client_org
  FROM "Project" p
  JOIN "Client" c ON c.id = p."clientId"
  WHERE c."organizationId" IS DISTINCT FROM p."organizationId"
  ORDER BY p.number
`);

if (mismatched.length === 0) {
  console.log("✓ No cross-org project→client rows. Nothing to repair.");
} else {
  console.log(`✗ ${mismatched.length} project(s) point at a client in another organization:\n`);
  for (const r of mismatched) {
    console.log(`  ${r.project_number}  ${r.project_name}`);
    console.log(`    project org : ${r.project_org}`);
    console.log(`    client      : ${r.client_name} (${r.client_id})`);
    console.log(`    client org  : ${r.client_org}\n`);
  }
  console.log(
    "Each of these is invisible to the app under RLS. Decide per row whether\n" +
    "the client belongs in the project's org (move the client) or the project\n" +
    "was created against the wrong client (repoint it). Both are data edits —\n" +
    "this script deliberately only reports.",
  );
}

// Quotations reach a client the same way, and can also carry their own
// clientId. A mismatch there breaks the quotation list and detail pages.
const quotes = await prisma.$queryRawUnsafe(`
  SELECT q.id, q.number, q."organizationId" AS quote_org, c."organizationId" AS client_org
  FROM "Quotation" q
  JOIN "Client" c ON c.id = q."clientId"
  WHERE c."organizationId" IS DISTINCT FROM q."organizationId"
  ORDER BY q.number
`);

if (quotes.length > 0) {
  console.log(`\n✗ ${quotes.length} quotation(s) point at a client in another organization:`);
  for (const r of quotes) console.log(`  ${r.number}  quote org ${r.quote_org} → client org ${r.client_org}`);
}

await prisma.$disconnect();
