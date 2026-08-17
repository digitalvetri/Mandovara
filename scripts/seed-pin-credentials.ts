// Upsert 9 employee users with 4-digit PIN authentication.
// Run AFTER pnpm db:seed: npx tsx scripts/seed-pin-credentials.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PIN_USERS = [
  { role: "OWNER",           name: "Rohit Sharma",    mobile: "+918940430051", pin: "1234" },
  { role: "DESIGNER",        name: "Priya Meenakshi", mobile: "+919842110001", pin: "2001" },
  { role: "SALES",           name: "Arjun Kumar",     mobile: "+919842110002", pin: "2002" },
  { role: "MEASURE_EXEC",    name: "Karthik Rajan",   mobile: "+919842110003", pin: "2003" },
  { role: "STORE",           name: "Selvi Lakshmi",   mobile: "+919842110004", pin: "2004" },
  { role: "MAKE_SUPERVISOR", name: "Murugan M",       mobile: "+919842110005", pin: "2005" },
  { role: "INSTALLER",       name: "Dinesh P",        mobile: "+919842110006", pin: "2006" },
  { role: "ACCOUNTS",        name: "Kavitha R",       mobile: "+919842110007", pin: "2007" },
  { role: "HR",              name: "Anand S",         mobile: "+919842110008", pin: "2008" },
] as const;

async function main() {
  // Use the first org in the DB (created by pnpm db:seed or setup-dev-org.ts)
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("No organization found. Run pnpm db:seed or npx tsx scripts/setup-dev-org.ts first.");
    process.exit(1);
  }

  const branch = await db.branch.findFirst({ where: { organizationId: org.id } });
  if (!branch) {
    console.error("No branch found for org. Check the seed.");
    process.exit(1);
  }

  console.log(`Using org: ${org.name} (${org.id})`);
  console.log(`Using branch: ${branch.name} (${branch.id})\n`);

  for (const spec of PIN_USERS) {
    const pinHash = bcrypt.hashSync(spec.pin, 10);
    const user = await db.user.upsert({
      where: {
        organizationId_mobile: { organizationId: org.id, mobile: spec.mobile },
      },
      create: {
        organizationId: org.id,
        name:           spec.name,
        mobile:         spec.mobile,
        role:           spec.role,
        passwordHash:   pinHash,
        branchIds:      [branch.id],
        locale:         "en",
        status:         "ACTIVE",
      },
      update: {
        passwordHash: pinHash,
        name:         spec.name,
        role:         spec.role,
      },
    });
    console.log(
      `✓ ${spec.role.padEnd(16)} ${spec.name.padEnd(20)} ${spec.mobile}  PIN: ${spec.pin}  → ${user.id}`,
    );
  }

  console.log("\nPIN credentials ready. Login with mobile number + 4-digit PIN.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
