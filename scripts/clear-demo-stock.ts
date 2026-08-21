// Clear all StockBalance and StockMove records from the Mandovara org.
//
// Run after seeding if you want the /inventory (Stocks) page to start
// empty — the seed populates the product catalogue (Brand, Collection,
// Design, Colourway) but real stock only arrives through GRNs.
//
// Catalog data (Brand / Collection / Design / Colourway / Price) is
// left completely untouched.
//
// Usage:  pnpm tsx scripts/clear-demo-stock.ts
//         (or npx tsx scripts/clear-demo-stock.ts)

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main(): Promise<void> {
  const org = await db.organization.findFirst({
    where:  { name: "Mandovara" },
    select: { id: true },
  });
  if (!org) throw new Error("No Mandovara organisation found. Run scripts/bootstrap-admin.ts first.");

  const [balances, moves] = await Promise.all([
    db.stockBalance.count({ where: { organizationId: org.id } }),
    db.stockMove.count({ where: { organizationId: org.id } }),
  ]);

  console.log(`Found: ${balances} StockBalance row(s), ${moves} StockMove row(s)`);

  if (balances === 0 && moves === 0) {
    console.log("Nothing to clear — stock is already empty.");
    return;
  }

  const [deletedBalances, deletedMoves] = await db.$transaction([
    db.stockBalance.deleteMany({ where: { organizationId: org.id } }),
    db.stockMove.deleteMany({ where: { organizationId: org.id } }),
  ]);

  console.log(`Deleted: ${deletedBalances.count} StockBalance, ${deletedMoves.count} StockMove`);
  console.log("Done — /inventory will now show an empty state.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
