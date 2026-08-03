// Master data — org, branches, roles, users, warehouses, employees, vendors.
import { PrismaClient } from "@prisma/client";
import {
  COMPANY_SUFFIXES, FIRST_NAMES_TN, LAST_NAMES_TN, PERMISSION_KEYS,
  ROLES, STATE_CODES, TN_CITIES,
} from "./data";
import { makeGstin, makeRng, makePan } from "./rng";

export interface SeedIds {
  orgId: string;
  branchIds: string[];
  branchNames: string[];
  warehouseIds: string[];
  binIdsByWarehouse: Map<string, string[]>;
  userIds: string[];
  ownerUserId: string;
  roleIdsByKey: Map<string, string>;
  employeeIds: string[];
  vendorIds: string[];
}

export async function seedMasters(db: PrismaClient, seed = 42): Promise<SeedIds> {
  const rng = makeRng(seed);

  // ── Organization + branches ─────────────────────────────────
  const org = await db.organization.create({
    data: {
      name: "Mandovara Business Solutions",
      gstin: makeGstin(rng.next, STATE_CODES.TN),
      pan: makePan(rng.next, "C"),
      fyStartMonth: 4,
      settings: { theme: "sovereign", locale: "en", tz: "Asia/Kolkata" },
    },
  });

  const branches = await Promise.all([
    db.branch.create({
      data: {
        orgId: org.id, name: "Coimbatore HQ",
        gstin: makeGstin(rng.next, STATE_CODES.TN), stateCode: STATE_CODES.TN,
        address: { line1: "123 Avinashi Road", city: "Coimbatore", pincode: "641018" },
        invoicePrefix: "MDV/CBE",
      },
    }),
    db.branch.create({
      data: {
        orgId: org.id, name: "Chennai Branch",
        gstin: makeGstin(rng.next, STATE_CODES.TN), stateCode: STATE_CODES.TN,
        address: { line1: "45 Anna Salai", city: "Chennai", pincode: "600002" },
        invoicePrefix: "MDV/CHE",
      },
    }),
  ]);

  // ── Roles + permissions ─────────────────────────────────────
  const roleIdsByKey = new Map<string, string>();
  for (const r of ROLES) {
    const role = await db.role.create({ data: { orgId: org.id, name: r.name } });
    roleIdsByKey.set(r.key, role.id);
    const isOwnerOrManager = r.key === "OWNER" || r.key === "MANAGER";
    await db.rolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        roleId: role.id,
        key,
        scope: (isOwnerOrManager ? "FULL" : subsetScope(r.key, key)) as never,
      })),
    });
  }

  // ── Users ───────────────────────────────────────────────────
  const userNames = pickUnique(rng, FIRST_NAMES_TN, LAST_NAMES_TN, 25);
  const users = [];
  const ownerName = userNames[0]!;
  const ownerUser = await db.user.create({
    data: {
      orgId: org.id, mobile: `+91${9800000000 + rng.int(0, 9_999_999)}`,
      email: `owner@mandovara.example`, name: `${ownerName.first} ${ownerName.last}`,
      status: "ACTIVE", locale: "en", branchIds: branches.map((b) => b.id),
    },
  });
  users.push(ownerUser.id);
  await db.userRole.create({ data: { userId: ownerUser.id, roleId: roleIdsByKey.get("OWNER")! } });

  for (let i = 1; i < 25; i++) {
    const n = userNames[i]!;
    const roleKey = roleForIndex(i);
    const branchIds = [branches[rng.int(0, 1)]!.id];
    const user = await db.user.create({
      data: {
        orgId: org.id,
        mobile: `+91${9700000000 + i * 100 + rng.int(0, 99)}`,
        email: `${n.first.toLowerCase()}.${n.last.toLowerCase()}${i}@mandovara.example`,
        name: `${n.first} ${n.last}`,
        status: "ACTIVE", locale: rng.boolean(0.3) ? "ta" : "en", branchIds,
      },
    });
    users.push(user.id);
    await db.userRole.create({ data: { userId: user.id, roleId: roleIdsByKey.get(roleKey)! } });
  }

  // ── Warehouses + racks + bins ──────────────────────────────
  const warehouseIds: string[] = [];
  const binIdsByWarehouse = new Map<string, string[]>();
  const whSpec = [
    { name: "Main Godown",    branchIdx: 0 },
    { name: "Site Store",     branchIdx: 0 },
    { name: "Chennai Godown", branchIdx: 1 },
  ];
  for (const w of whSpec) {
    const wh = await db.warehouse.create({
      data: {
        orgId: org.id, branchId: branches[w.branchIdx]!.id, name: w.name,
        address: { city: TN_CITIES[w.branchIdx * 3 % TN_CITIES.length] },
      },
    });
    warehouseIds.push(wh.id);
    const rackCodes = ["A", "B", "C", "D", "E"];
    const bins: string[] = [];
    for (const rc of rackCodes) {
      const rack = await db.rack.create({ data: { warehouseId: wh.id, code: rc } });
      for (let b = 1; b <= 8; b++) {
        const bin = await db.bin.create({ data: { rackId: rack.id, code: `${rc}${b.toString().padStart(2, "0")}` } });
        bins.push(bin.id);
      }
    }
    binIdsByWarehouse.set(wh.id, bins);
  }

  // ── Employees (mirror users so payroll has real people) ────
  const employeeIds: string[] = [];
  for (let i = 0; i < 25; i++) {
    const n = userNames[i]!;
    const emp = await db.employee.create({
      data: {
        orgId: org.id, branchId: branches[rng.int(0, 1)]!.id,
        code: `EMP${String(1001 + i).padStart(4, "0")}`,
        userId: users[i]!,
        name: `${n.first} ${n.last}`,
        mobile: `+91${9600000000 + i * 100}`,
        designation: roleForIndex(i),
        department: departmentForRole(roleForIndex(i)),
        joinDate: new Date(2023 + rng.int(0, 2), rng.int(0, 11), rng.int(1, 28)),
        panNumber: makePan(rng.next),
      },
    });
    employeeIds.push(emp.id);

    const ctc = BigInt((rng.int(20, 80) * 100000) * 100); // ₹2L–8L / month × 100 for paise
    const structure = await db.salaryStructure.create({
      data: { orgId: org.id, employeeId: emp.id, effectiveFrom: emp.joinDate, ctc },
    });
    const basic = ctc / 2n;
    const hra   = ctc / 4n;
    const spec  = ctc - basic - hra;
    await db.salaryComponent.createMany({
      data: [
        { salaryStructureId: structure.id, name: "BASIC",   amount: basic, isEarning: true,  ordering: 1 },
        { salaryStructureId: structure.id, name: "HRA",     amount: hra,   isEarning: true,  ordering: 2 },
        { salaryStructureId: structure.id, name: "SPECIAL", amount: spec,  isEarning: true,  ordering: 3 },
        { salaryStructureId: structure.id, name: "PF_EMPLOYEE", amount: 1800n * 100n, isEarning: false, isTaxable: false, ordering: 10 },
      ],
    });
  }

  // ── Vendors ────────────────────────────────────────────────
  const vendorIds: string[] = [];
  const vendorData = [];
  for (let i = 0; i < 60; i++) {
    const suffix = COMPANY_SUFFIXES[i % COMPANY_SUFFIXES.length]!;
    const first = FIRST_NAMES_TN[rng.int(0, FIRST_NAMES_TN.length - 1)]!;
    const stateCode = rng.weighted([[STATE_CODES.TN, 7], [STATE_CODES.KA, 2], [STATE_CODES.KL, 1]]);
    vendorData.push({
      orgId: org.id,
      name: `${first} ${suffix} #${1001 + i}`,
      gstin: makeGstin(rng.next, stateCode),
      pan: makePan(rng.next),
      status: "ACTIVE" as const,
      stateCode,
      mobile: `+91${9500000000 + i * 1000}`,
      paymentTerms: rng.pick([15, 30, 45, 60]),
    });
  }
  const created = await db.vendor.createManyAndReturn({ data: vendorData });
  vendorIds.push(...created.map((v) => v.id));

  // ── Statutory slabs (India, table-driven) ──────────────────
  const from2025 = new Date(2025, 3, 1);
  await db.statutorySlab.createMany({
    data: [
      // PF 12% of basic up to ceiling
      { orgId: org.id, kind: "PF", fromAmount: 0n, toAmount: 1_500_000n, employeeRate: 0.12, employerRate: 0.12, effectiveFrom: from2025 },
      // ESI applicable below 21,000
      { orgId: org.id, kind: "ESI", fromAmount: 0n, toAmount: 2_100_000n, employeeRate: 0.0075, employerRate: 0.0325, effectiveFrom: from2025 },
      // TN professional tax — half-yearly slab (approximate)
      { orgId: org.id, kind: "PT_TN", fromAmount: 0n,       toAmount: 2_100_000n,   flatAmount: 0n,        effectiveFrom: from2025 },
      { orgId: org.id, kind: "PT_TN", fromAmount: 2_100_000n, toAmount: 3_000_000n, flatAmount: 13_500n,   effectiveFrom: from2025 },
      { orgId: org.id, kind: "PT_TN", fromAmount: 3_000_000n, toAmount: 4_500_000n, flatAmount: 31_500n,   effectiveFrom: from2025 },
      { orgId: org.id, kind: "PT_TN", fromAmount: 4_500_000n, toAmount: 6_000_000n, flatAmount: 63_000n,   effectiveFrom: from2025 },
      { orgId: org.id, kind: "PT_TN", fromAmount: 6_000_000n, toAmount: 7_500_000n, flatAmount: 94_500n,   effectiveFrom: from2025 },
      { orgId: org.id, kind: "PT_TN", fromAmount: 7_500_000n, toAmount: null,       flatAmount: 125_000n,  effectiveFrom: from2025 },
    ],
  });

  return {
    orgId: org.id,
    branchIds: branches.map((b) => b.id),
    branchNames: branches.map((b) => b.name),
    warehouseIds, binIdsByWarehouse,
    userIds: users, ownerUserId: ownerUser.id,
    roleIdsByKey, employeeIds, vendorIds,
  };
}

function roleForIndex(i: number): string {
  const map = ["OWNER", "MANAGER", "MANAGER", "SALES", "SALES", "SALES", "SALES", "SALES",
               "STORE", "STORE", "STORE", "STORE", "ACCOUNTS", "ACCOUNTS", "ACCOUNTS",
               "HR", "HR", "SITE", "SITE", "SITE", "SITE", "SALES", "STORE", "SITE", "MANAGER"];
  return map[i % map.length]!;
}

function departmentForRole(role: string): string {
  return {
    OWNER: "Leadership", MANAGER: "Operations", SALES: "Sales",
    STORE: "Warehouse", ACCOUNTS: "Finance", HR: "HR", SITE: "Projects",
  }[role] ?? "Operations";
}

function subsetScope(roleKey: string, permKey: string): "NONE" | "VIEW" | "OWN" | "FULL" {
  // Rough model — real registry is Session 4.
  if (roleKey === "SALES" && permKey.startsWith("product.")) return "VIEW";
  if (roleKey === "SALES" && permKey === "product.viewCost") return "NONE";
  if (roleKey === "SALES" && (permKey.startsWith("client.") || permKey.startsWith("quotation."))) return "OWN";
  if (roleKey === "STORE" && (permKey.startsWith("stock.") || permKey.startsWith("grn."))) return "FULL";
  if (roleKey === "STORE" && permKey === "payroll.view") return "NONE";
  if (roleKey === "ACCOUNTS" && (permKey.startsWith("invoice.") || permKey.startsWith("receipt."))) return "FULL";
  if (roleKey === "HR" && (permKey.startsWith("payroll.") || permKey.startsWith("attendance."))) return "FULL";
  if (roleKey === "SITE" && permKey.startsWith("attendance.")) return "FULL";
  return "VIEW";
}

interface Name { first: string; last: string }
function pickUnique(rng: ReturnType<typeof makeRng>, firsts: readonly string[], lasts: readonly string[], n: number): Name[] {
  const out: Name[] = [];
  const seen = new Set<string>();
  while (out.length < n) {
    const f = firsts[rng.int(0, firsts.length - 1)]!;
    const l = lasts[rng.int(0, lasts.length - 1)]!;
    const key = `${f} ${l}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ first: f, last: l });
  }
  return out;
}
