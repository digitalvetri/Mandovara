// Mirrors production Users & Employees into local Org Alpha for dev testing.
// Safe to re-run — upserts by email.
// Run with: node create-dev-employees.cjs

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();

const PASSWORD = "mandovara@2026";

const USERS = [
  { email: "aishwarya@mandovara.com", name: "Aishwarya Raj",    mobile: "+919843012346", role: "DESIGNER"        },
  { email: "bala@mandovara.com",      name: "Bala Kumar",       mobile: "+919876500010", role: "MEASURE_EXEC"    },
  { email: "deepa@mandovara.com",     name: "Deepa Iyer",       mobile: "+919876500011", role: "ACCOUNTS"        },
  { email: "karthik@mandovara.com",   name: "Karthik Suresh",   mobile: "+919876500012", role: "SALES"           },
  { email: "manoj@mandovara.com",     name: "Manoj Krishnan",   mobile: "+919876500013", role: "MAKE_SUPERVISOR" },
  { email: "priya@mandovara.com",     name: "Priya Natarajan",  mobile: "+919876500014", role: "HR"              },
  { email: "rohit@mandovara.com",     name: "Rohit Mandovara",  mobile: "+919843012345", role: "OWNER"           },
  { email: "senthil@mandovara.com",   name: "Senthil Murugan",  mobile: "+919876500015", role: "STORE"           },
  { email: "tester@mandovara.com",    name: "Test User",        mobile: "+919876500016", role: "OWNER"           },
  { email: "vignesh@mandovara.com",   name: "Vignesh Prasad",   mobile: "+919876500017", role: "STORE"           },
];

// Employee records from production (only Aishwarya Raj exists so far)
const EMPLOYEES = [
  {
    email:       "aishwarya@mandovara.com",
    code:        "EMP-002",
    name:        "Aishwarya Raj",
    designation: "Senior Designer",
    department:  "Design",
    mobile:      "+919843012346",
    doj:         new Date("2024-01-15"),
  },
];

(async () => {
  const org = await p.organization.findFirst({ where: { name: "Org Alpha" }, select: { id: true } });
  if (!org) throw new Error("Org Alpha not found");
  const branch = await p.branch.findFirst({ where: { organizationId: org.id }, select: { id: true } });
  const pwHash = bcrypt.hashSync(PASSWORD, 10);

  // ── Upsert users ──────────────────────────────────────────────────────────
  console.log("── Users ──────────────────────────────────────");
  for (const u of USERS) {
    const existing = await p.user.findFirst({ where: { email: u.email } });
    if (existing) {
      await p.user.update({
        where: { id: existing.id },
        data:  { name: u.name, passwordHash: pwHash, mustChangePassword: false, role: u.role, status: "ACTIVE" },
      });
      console.log(`  updated: ${u.name} (${u.email})`);
    } else {
      // Check if mobile is taken
      const mobileExists = await p.user.findFirst({ where: { organizationId: org.id, mobile: u.mobile } });
      const mobile = mobileExists ? u.mobile.replace("+91", "+910") : u.mobile;
      await p.user.create({
        data: {
          organizationId:   org.id,
          name:             u.name,
          email:            u.email,
          mobile,
          passwordHash:     pwHash,
          mustChangePassword: false,
          role:             u.role,
          branchIds:        branch ? [branch.id] : [],
          locale:           "en",
          status:           "ACTIVE",
        },
      });
      console.log(`  created: ${u.name} (${u.email})`);
    }
  }

  // ── Remove stale placeholder employees first ─────────────────────────────
  const stale = ["EMP001","EMP002","EMP003"];
  for (const code of stale) {
    const e = await p.employee.findFirst({ where: { organizationId: org.id, code } });
    if (e) { await p.employee.delete({ where: { id: e.id } }); console.log(`\n  removed stale: ${code}`); }
  }

  // ── Upsert employees ──────────────────────────────────────────────────────
  console.log("\n── Employees ──────────────────────────────────");
  for (const spec of EMPLOYEES) {
    const user = await p.user.findFirst({ where: { email: spec.email }, select: { id: true } });
    if (!user) { console.log(`  skip (no user): ${spec.name}`); continue; }

    const existing = await p.employee.findFirst({
      where: { organizationId: org.id, code: spec.code },
      select: { id: true },
    });

    if (existing) {
      await p.employee.update({
        where: { id: existing.id },
        data:  { userId: user.id, name: spec.name, designation: spec.designation },
      });
      console.log(`  updated: ${spec.name} (${spec.code})`);
    } else {
      await p.employee.create({
        data: {
          organizationId: org.id,
          userId:         user.id,
          code:           spec.code,
          name:           spec.name,
          mobile:         spec.mobile,
          designation:    spec.designation,
          department:     spec.department,
          doj:            spec.doj,
          status:         "ACTIVE",
        },
      });
      console.log(`  created: ${spec.name} (${spec.code})`);
    }
  }

  console.log(`\nAll done. Password for every account: ${PASSWORD}`);
  console.log("Log in at localhost:3000 → /employee to test the dashboard.");
})()
  .catch(console.error)
  .finally(() => p.$disconnect());
