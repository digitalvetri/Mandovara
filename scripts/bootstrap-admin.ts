// Bootstrap after `prisma migrate reset` — creates the minimum shape
// needed to log into a fresh Mandovara install:
//   1 Organization  → "Mandovara"
//   1 Branch        → "RS Puram" (invoicePrefix MDV, state code 33)
//   1 User          → Owner, mobile-first identity, bcrypt password
//
// Session.ts resolves an OWNER user with User.roleId=null via the
// legacy fallback (`allPermissions()`), so the admin gets full
// permissions without needing to seed a Role row.
//
// Run:  pnpm tsx scripts/bootstrap-admin.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const CONFIG = {
  org: {
    name:      "Mandovara",
    stateCode: "33",
  },
  branch: {
    name:          "RS Puram",
    invoicePrefix: "MDV",
    stateCode:     "33",
  },
  admin: {
    name:   "Rohit",
    mobile: "+918940430051",
    email:  "rohit@mandovara.com",
    // No hardcoded default. Supply it at run time so a real production
    // password never lives in the repo (or in a shipped sourcemap):
    //   BOOTSTRAP_ADMIN_PASSWORD='...' pnpm tsx scripts/bootstrap-admin.ts
    password: process.env["BOOTSTRAP_ADMIN_PASSWORD"] ?? "",
  },
};

if (!CONFIG.admin.password || CONFIG.admin.password.length < 10) {
  console.error(
    "BOOTSTRAP_ADMIN_PASSWORD must be set and at least 10 characters.\n" +
    "  BOOTSTRAP_ADMIN_PASSWORD='<strong password>' pnpm tsx scripts/bootstrap-admin.ts",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const existing = await db.organization.findFirst({ where: { name: CONFIG.org.name } });
    if (existing) {
      console.log(`Organization "${CONFIG.org.name}" already exists (${existing.id}). Nothing to do.`);
      return;
    }

    console.log("Creating organization...");
    const org = await db.organization.create({
      data: {
        name:      CONFIG.org.name,
        stateCode: CONFIG.org.stateCode,
        settings:  {},
      },
    });

    console.log("Creating branch...");
    const branch = await db.branch.create({
      data: {
        organizationId: org.id,
        name:           CONFIG.branch.name,
        invoicePrefix:  CONFIG.branch.invoicePrefix,
        stateCode:      CONFIG.branch.stateCode,
      },
    });

    console.log("Creating admin user...");
    const passwordHash = await bcrypt.hash(CONFIG.admin.password, 10);
    const user = await db.user.create({
      data: {
        organizationId: org.id,
        name:           CONFIG.admin.name,
        mobile:         CONFIG.admin.mobile,
        email:          CONFIG.admin.email,
        role:           "OWNER",
        branchIds:      [branch.id],
        passwordHash,
        status:         "ACTIVE",
      },
    });

    console.log("\n✓ Bootstrap complete");
    console.log("─".repeat(48));
    console.log(`  Organization:  ${org.name} (${org.id.slice(0, 12)}…)`);
    console.log(`  Branch:        ${branch.name} · ${branch.invoicePrefix}`);
    console.log(`  Admin login:   ${user.email}`);
    console.log(`                 mobile ${user.mobile}`);
    console.log(`                 password: ${CONFIG.admin.password}`);
    console.log("─".repeat(48));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
