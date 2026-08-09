// Master data — org, branch, users, employees, vendors, statutory slabs, number sequences.
// No @ts-nocheck — this file must typecheck cleanly against the actual schema.
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { makeGstin, makeRng, makePan } from "./rng";
import { seedRoles } from "./roles";

// Default password for all seeded users. Change before going to production.
export const DEFAULT_DEV_PASSWORD = "Mandovara@2026";

export interface SeedMasterIds {
  orgId: string;
  branchId: string;
  userByRole: Record<string, string>; // "OWNER" → userId, etc.
  employeeIds: string[];
  vendorIds: string[];
}

// ── User definitions (9, one per AppRole) ────────────────────────────────────

const USER_SPECS = [
  { role: "OWNER",          name: "Rohit Mandovara",  mobile: "+91 9843012345", email: "rohit@mandovara.com"     },
  { role: "DESIGNER",       name: "Aishwarya Raj",    mobile: "+91 9843012346", email: "aishwarya@mandovara.com" },
  { role: "SALES",          name: "Karthik Suresh",   mobile: "+91 9843012347", email: "karthik@mandovara.com"   },
  { role: "MEASURE_EXEC",   name: "Bala Kumar",       mobile: "+91 9843012348", email: "bala@mandovara.com"      },
  { role: "STORE",          name: "Senthil Murugan",  mobile: "+91 9843012349", email: "senthil@mandovara.com"   },
  { role: "MAKE_SUPERVISOR",name: "Manoj Krishnan",   mobile: "+91 9843012350", email: "manoj@mandovara.com"     },
  { role: "INSTALLER",      name: "Vignesh Prasad",   mobile: "+91 9843012351", email: "vignesh@mandovara.com"   },
  { role: "ACCOUNTS",       name: "Deepa Iyer",       mobile: "+91 9843012352", email: "deepa@mandovara.com"     },
  { role: "HR",             name: "Priya Natarajan",  mobile: "+91 9843012353", email: "priya@mandovara.com"     },
] as const;

// ── Department map by role ────────────────────────────────────────────────────

const DEPT_BY_ROLE: Record<string, string> = {
  OWNER:           "SALES",
  DESIGNER:        "DESIGN",
  SALES:           "SALES",
  MEASURE_EXEC:    "MEASURE",
  STORE:           "STORE",
  MAKE_SUPERVISOR: "MAKE",
  INSTALLER:       "INSTALL",
  ACCOUNTS:        "ACCOUNTS",
  HR:              "HR",
};

const DESIGNATION_BY_ROLE: Record<string, string> = {
  OWNER:           "Managing Director",
  DESIGNER:        "Senior Designer",
  SALES:           "Sales Executive",
  MEASURE_EXEC:    "Measurement Executive",
  STORE:           "Store Keeper",
  MAKE_SUPERVISOR: "Make Supervisor",
  INSTALLER:       "Installation Technician",
  ACCOUNTS:        "Accounts Manager",
  HR:              "HR Executive",
};

// ── Vendor definitions (15) ───────────────────────────────────────────────────

const VENDOR_SPECS = [
  // 5 wallpaper importers
  { name: "Grandeco India Pvt Ltd",   category: "wallpaper", paymentTermsDays: 45, leadTimeDays: 21 },
  { name: "G&B Wallcoverings India",  category: "wallpaper", paymentTermsDays: 30, leadTimeDays: 28 },
  { name: "York India",               category: "wallpaper", paymentTermsDays: 60, leadTimeDays: 35 },
  { name: "Nilaya Wallpapers",        category: "wallpaper", paymentTermsDays: 30, leadTimeDays: 14 },
  { name: "Divine Décors Pvt Ltd",    category: "wallpaper", paymentTermsDays: 45, leadTimeDays: 21 },
  // 4 fabric suppliers
  { name: "Fibre Naturelle India",    category: "fabric",    paymentTermsDays: 30, leadTimeDays: 14 },
  { name: "Rialto Fabrics India",     category: "fabric",    paymentTermsDays: 30, leadTimeDays: 10 },
  { name: "Miros Textiles",           category: "fabric",    paymentTermsDays: 45, leadTimeDays: 14 },
  { name: "Casamance India",          category: "fabric",    paymentTermsDays: 60, leadTimeDays: 21 },
  // 3 flooring distributors
  { name: "Quick-Step India",         category: "flooring",  paymentTermsDays: 30, leadTimeDays: 10 },
  { name: "Pergo India Pvt Ltd",      category: "flooring",  paymentTermsDays: 45, leadTimeDays: 14 },
  { name: "Gerflor India",            category: "flooring",  paymentTermsDays: 30, leadTimeDays: 7  },
  // 2 blind hardware
  { name: "Toso India",               category: "blind",     paymentTermsDays: 30, leadTimeDays: 14 },
  { name: "Rolluya Systems",          category: "blind",     paymentTermsDays: 45, leadTimeDays: 21 },
  // 1 film supplier
  { name: "3M India Ltd",             category: "film",      paymentTermsDays: 30, leadTimeDays: 7  },
] as const;

// ── Extra standalone employees (9, no userId) ─────────────────────────────────

const EXTRA_EMPLOYEE_SPECS = [
  // 3 INSTALL
  { name: "Arjun Selvam",     mobile: "+91 9500000010", designation: "Installer",               department: "INSTALL" },
  { name: "Dinesh Rajan",     mobile: "+91 9500000011", designation: "Installer",               department: "INSTALL" },
  { name: "Gokul Saravanan",  mobile: "+91 9500000012", designation: "Senior Installer",        department: "INSTALL" },
  // 3 MAKE
  { name: "Muthu Lakshmi",    mobile: "+91 9500000013", designation: "Tailor",                  department: "MAKE"    },
  { name: "Kavitha Devi",     mobile: "+91 9500000014", designation: "Senior Tailor",           department: "MAKE"    },
  { name: "Ranjith Kumar",    mobile: "+91 9500000015", designation: "Cutting Master",          department: "MAKE"    },
  // 3 MEASURE
  { name: "Prakash Anand",    mobile: "+91 9500000016", designation: "Measurement Assistant",   department: "MEASURE" },
  { name: "Suresh Babu",      mobile: "+91 9500000017", designation: "Measurement Executive",   department: "MEASURE" },
  { name: "Nithya Moorthy",   mobile: "+91 9500000018", designation: "Site Survey Executive",   department: "MEASURE" },
] as const;

// ── Salary structure helper ───────────────────────────────────────────────────

function salaryStructure(dept: string): { basic: string; hra: string; conveyance: string } {
  const map: Record<string, { basic: string; hra: string; conveyance: string }> = {
    SALES:    { basic: "35000", hra: "14000", conveyance: "3000" },
    DESIGN:   { basic: "40000", hra: "16000", conveyance: "3000" },
    MEASURE:  { basic: "25000", hra: "10000", conveyance: "2000" },
    STORE:    { basic: "28000", hra: "11200", conveyance: "2000" },
    MAKE:     { basic: "22000", hra:  "8800", conveyance: "2000" },
    INSTALL:  { basic: "24000", hra:  "9600", conveyance: "2500" },
    ACCOUNTS: { basic: "38000", hra: "15200", conveyance: "3000" },
    HR:       { basic: "30000", hra: "12000", conveyance: "2000" },
  };
  return map[dept] ?? { basic: "25000", hra: "10000", conveyance: "2000" };
}

// ── Number series list ────────────────────────────────────────────────────────

const ALL_SERIES = ["ENQ", "PRJ", "MEA", "QT", "SO", "PO", "GRN", "MJ", "INS", "INV", "RCT", "SMP", "CN", "SV", "REQ"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function seedMasters(db: PrismaClient, seed?: number): Promise<SeedMasterIds> {
  const rng = makeRng(seed ?? 42);

  // ── Organization ───────────────────────────────────────────────────────────
  const org = await db.organization.create({
    data: {
      name:        "Mandovara",
      legalName:   "Mandovara Interior Solutions",
      gstin:       makeGstin(rng.next, "33"),
      pan:         makePan(rng.next, "C"),
      addressLine: "32 Thirumoorthy Layout, Thadagam Road, RS Puram",
      city:        "Coimbatore",
      state:       "Tamil Nadu",
      stateCode:   "33",
      pincode:     "641002",
      phone:       "+91 8940430051",
      email:       "mandovara22@gmail.com",
      website:     "https://mandovara.com",
      fyStartMonth: 4,
      settings: {
        wastage: {
          flooring_straight:   7,
          flooring_diagonal:  10,
          flooring_herringbone: 15,
          wallpaper:          10,
          carpet:             10,
        },
        fullness: {
          sheer:              2.5,
          main_pinch_pleat:   2.5,
          main_eyelet:        2.0,
          main_pencil_pleat:  2.5,
        },
        roll: {
          width_mm: 530,
          length_m: 10.05,
        },
        hem: {
          side_mm:    40,
          heading_mm: 150,
          bottom_mm:  200,
        },
        currency: "INR",
        tz: "Asia/Kolkata",
      } as Prisma.InputJsonValue,
    },
  });

  // ── Branch ─────────────────────────────────────────────────────────────────
  const branch = await db.branch.create({
    data: {
      organizationId: org.id,
      name:           "RS Puram Showroom",
      gstin:          makeGstin(rng.next, "33"),
      stateCode:      "33",
      address: {
        line1:   "32 Thirumoorthy Layout, Thadagam Road, RS Puram",
        city:    "Coimbatore",
        state:   "Tamil Nadu",
        pincode: "641002",
      } as Prisma.InputJsonValue,
      invoicePrefix: "MDV",
    },
  });

  // ── Users (9, one per AppRole) ─────────────────────────────────────────────
  const pwHash = bcrypt.hashSync(DEFAULT_DEV_PASSWORD, 10);
  const userRows: Prisma.UserCreateManyInput[] = USER_SPECS.map((u) => ({
    organizationId: org.id,
    mobile:         u.mobile,
    email:          u.email,
    name:           u.name,
    passwordHash:   pwHash,
    role:           u.role as Prisma.UserCreateManyInput["role"],
    branchIds:      [branch.id],
    locale:         "en",
    status:         "ACTIVE",
  }));

  const createdUsers = await db.user.createManyAndReturn({ data: userRows });

  const userByRole: Record<string, string> = Object.fromEntries(
    createdUsers.map((u) => [u.role as string, u.id]),
  );

  // ── Roles + Permissions (dynamic RBAC) ────────────────────────────────────
  await seedRoles(db, org.id, userByRole);

  // ── Employees (18) ─────────────────────────────────────────────────────────
  // 9 user-linked (EMP-001..009) + 9 standalone (EMP-010..018)
  const employeeRows: Prisma.EmployeeCreateManyInput[] = [];

  // User-linked employees
  for (let i = 0; i < USER_SPECS.length; i++) {
    const spec = USER_SPECS[i]!;
    const dept = DEPT_BY_ROLE[spec.role]!;
    const salary = salaryStructure(dept);
    employeeRows.push({
      organizationId:  org.id,
      userId:          userByRole[spec.role],
      code:            `EMP-${String(i + 1).padStart(3, "0")}`,
      name:            spec.name,
      mobile:          spec.mobile,
      designation:     DESIGNATION_BY_ROLE[spec.role]!,
      department:      dept,
      doj:             rng.daysAgo(365, 1095),
      salaryStructure: salary as Prisma.InputJsonValue,
      status:          "ACTIVE",
    });
  }

  // Standalone employees (no userId)
  for (let i = 0; i < EXTRA_EMPLOYEE_SPECS.length; i++) {
    const spec = EXTRA_EMPLOYEE_SPECS[i]!;
    const salary = salaryStructure(spec.department);
    employeeRows.push({
      organizationId:  org.id,
      userId:          null,
      code:            `EMP-${String(USER_SPECS.length + i + 1).padStart(3, "0")}`,
      name:            spec.name,
      mobile:          spec.mobile,
      designation:     spec.designation,
      department:      spec.department,
      doj:             rng.daysAgo(180, 900),
      salaryStructure: salary as Prisma.InputJsonValue,
      status:          "ACTIVE",
    });
  }

  const createdEmployees = await db.employee.createManyAndReturn({ data: employeeRows });
  const employeeIds = createdEmployees.map((e) => e.id);

  // ── Vendors (15) ───────────────────────────────────────────────────────────
  const vendorRows: Prisma.VendorCreateManyInput[] = VENDOR_SPECS.map((v, i) => ({
    organizationId:  org.id,
    code:            `VND-${String(i + 1).padStart(3, "0")}`,
    name:            v.name,
    gstin:           makeGstin(rng.next, "33"),
    mobile:          `+91 98${String(40000000 + i * 1000 + rng.int(0, 999)).padStart(8, "0")}`,
    email:           `procurement@${v.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}.in`,
    address: {
      city:    "Coimbatore",
      state:   "Tamil Nadu",
      pincode: "641001",
    } as Prisma.InputJsonValue,
    paymentTermsDays: v.paymentTermsDays,
    leadTimeDays:     v.leadTimeDays,
    brandIds:         [],
    rating:           rng.int(3, 5),
  }));

  const createdVendors = await db.vendor.createManyAndReturn({ data: vendorRows });
  const vendorIds = createdVendors.map((v) => v.id);

  // ── Statutory Slabs ────────────────────────────────────────────────────────
  const from2020 = new Date("2020-04-01T00:00:00.000Z");
  const from2023 = new Date("2023-04-01T00:00:00.000Z");

  await db.statutorySlab.createMany({
    data: [
      // PF: 12% flat on basic (employer & employee each); no ceiling enforced at slab level
      {
        organizationId: org.id,
        kind:           "PF",
        stateCode:      null,
        fromAmount:     0n,
        toAmount:       null,
        rate:           new Prisma.Decimal("12.000"),
        flatAmount:     null,
        effectiveFrom:  from2020,
        effectiveTo:    null,
      },
      // ESI employer: 3.25% on gross up to ₹21,000/month
      {
        organizationId: org.id,
        kind:           "ESI_EMP",
        stateCode:      "33",
        fromAmount:     0n,
        toAmount:       2100000n,
        rate:           new Prisma.Decimal("3.250"),
        flatAmount:     null,
        effectiveFrom:  from2020,
        effectiveTo:    null,
      },
      // ESI employee: 0.75% on gross up to ₹21,000/month
      {
        organizationId: org.id,
        kind:           "ESI_EE",
        stateCode:      "33",
        fromAmount:     0n,
        toAmount:       2100000n,
        rate:           new Prisma.Decimal("0.750"),
        flatAmount:     null,
        effectiveFrom:  from2020,
        effectiveTo:    null,
      },
      // PT Tamil Nadu — nil slab (up to ₹21,000/month gross)
      {
        organizationId: org.id,
        kind:           "PT",
        stateCode:      "33",
        fromAmount:     0n,
        toAmount:       2100000n,
        rate:           null,
        flatAmount:     0n,
        effectiveFrom:  from2023,
        effectiveTo:    null,
      },
      // PT Tamil Nadu — ₹200/month (above ₹21,000/month gross)
      {
        organizationId: org.id,
        kind:           "PT",
        stateCode:      "33",
        fromAmount:     2100001n,
        toAmount:       null,
        rate:           null,
        flatAmount:     20000n,
        effectiveFrom:  from2023,
        effectiveTo:    null,
      },
    ],
  });

  // ── Number Sequences (all 13 series, yymm "2608", counter 0) ───────────────
  await db.numberSequence.createMany({
    data: ALL_SERIES.map((series) => ({
      organizationId: org.id,
      series,
      yymm:    "2608",
      counter: 0,
    })),
  });

  return {
    orgId:      org.id,
    branchId:   branch.id,
    userByRole,
    employeeIds,
    vendorIds,
  };
}
