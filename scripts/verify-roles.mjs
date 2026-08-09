import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const roles = await db.role.findMany({
  select: { name: true, isOwnerRole: true, _count: { select: { permissions: true } } },
  orderBy: { name: "asc" },
});
console.log("Roles:");
for (const r of roles) {
  console.log(`  ${r.name.padEnd(20)} isOwner=${r.isOwnerRole} perms=${r._count.permissions}`);
}

const users = await db.user.findMany({ select: { name: true, role: true, roleId: true } });
console.log("Users:");
for (const u of users) {
  console.log(`  ${u.name.padEnd(22)} role=${u.role} roleId=${u.roleId ? "set" : "null"}`);
}
await db.$disconnect();
