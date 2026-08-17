// One-time dev setup: creates the stub Organisation, Branch and Owner User
// that devContext() falls back to when no real session exists.
// Run with: npx tsx scripts/setup-dev-org.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Organisation
  await db.organization.upsert({
    where: { id: "dev-stub-org" },
    create: {
      id: "dev-stub-org",
      name: "Mandovara",
      legalName: "Mandovara Interiors",
      city: "Coimbatore",
      state: "Tamil Nadu",
      stateCode: "33",
      pincode: "641002",
      addressLine: "32 Thirumoorthy Layout, Thadagam Road, RS Puram",
      phone: "+918940430051",
      email: "mandovara22@gmail.com",
      website: "mandovara.com",
      fyStartMonth: 4,
      settings: {
        fullness: { EYELET: 2.0, PINCH_PLEAT: 2.5, PENCIL_PLEAT: 2.5, RIPPLE_FOLD: 1.8, TAB_TOP: 1.5, ROD_POCKET: 2.0 },
        wastage:  { FLOORING_STRAIGHT: 0.07, FLOORING_DIAGONAL: 0.10, FLOORING_HERRINGBONE: 0.15, WALLPAPER: 0.10, CARPET: 0.10, FILM: 0.08 },
        wallpaper: { rollWidthMm: 530, rollLengthM: 10.05 },
        curtain:   { sideHemMm: 25, headingAllowanceMm: 200, bottomHemMm: 100, eyeletSpacingMm: 150 },
        blind:     { clearanceMm: 6, overlapMm: 75, overlapTopMm: 100, roundToMm: 25 },
      },
    },
    update: {},
  });
  console.log("✓ Organisation: dev-stub-org");

  // 2. Branch
  const branch = await db.branch.upsert({
    where: { id: "dev-stub-branch" },
    create: {
      id: "dev-stub-branch",
      organizationId: "dev-stub-org",
      name: "RS Puram Showroom",
      stateCode: "33",
      invoicePrefix: "MDV",
      address: { line: "32 Thirumoorthy Layout, Thadagam Road, RS Puram", city: "Coimbatore", pincode: "641002" },
    },
    update: {},
  });
  console.log("✓ Branch:", branch.name);

  // 3. Owner User
  const user = await db.user.upsert({
    where: { id: "dev-stub-user" },
    create: {
      id: "dev-stub-user",
      organizationId: "dev-stub-org",
      name: "Rohit (Owner)",
      mobile: "+918940430051",
      role: "OWNER",
      branchIds: ["dev-stub-branch"],
      locale: "en",
      status: "ACTIVE",
    },
    update: {},
  });
  console.log("✓ User:", user.name, "(OWNER)");

  console.log("\nDev org ready. Restart the dev server if it was already running.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
