import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const c = await p.organization.count();
  process.stdout.write(String(c));
} catch (e) {
  process.stderr.write(`check-empty error: ${e?.message ?? String(e)}\n`);
  process.stdout.write("-1");
} finally {
  await p.$disconnect();
}
