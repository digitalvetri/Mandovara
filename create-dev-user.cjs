// One-time script: create Aishwarya as a SALES user in Org Alpha for local dev testing.
// Run with: node create-dev-user.cjs

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();

const EMAIL = "aishwarya@mandovara.com";
const PASSWORD = "mandovara@2026";
const NAME = "Aishwarya";

(async () => {
  // Find Org Alpha and its branch
  const org = await p.organization.findFirst({ where: { name: "Org Alpha" }, select: { id: true } });
  if (!org) throw new Error("Org Alpha not found — run tests first to seed fixture data");

  const branch = await p.branch.findFirst({ where: { organizationId: org.id }, select: { id: true } });

  // Check if already exists
  const existing = await p.user.findFirst({ where: { email: EMAIL } });
  if (existing) {
    // Just update the password
    const hash = bcrypt.hashSync(PASSWORD, 10);
    await p.user.update({ where: { id: existing.id }, data: { passwordHash: hash, mustChangePassword: false } });
    console.log(`Updated password for ${EMAIL}`);
    return;
  }

  const hash = bcrypt.hashSync(PASSWORD, 10);
  const user = await p.user.create({
    data: {
      organizationId: org.id,
      name: NAME,
      email: EMAIL,
      mobile: "+919876500001",
      passwordHash: hash,
      mustChangePassword: false,
      role: "SALES",
      branchIds: branch ? [branch.id] : [],
      locale: "en",
      status: "ACTIVE",
    },
  });

  console.log(`Created user: ${user.name} (${user.email})`);
  console.log(`Login with: ${EMAIL} / ${PASSWORD}`);
  console.log(`Note: This user is in "Org Alpha" — local test org, not production.`);
})()
  .catch(console.error)
  .finally(() => p.$disconnect());
