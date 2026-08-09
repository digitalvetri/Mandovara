import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  ARCHITECT_FIRMS,
  FIRST_NAMES_TN,
  KA_CITIES,
  KL_CITIES,
  LAST_NAMES_TN,
  STATE_CODES,
  TN_CITIES,
} from "./data";
import { makeGstin, makePan, makeRng } from "./rng";

// ─── State name lookup ────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  "33": "Tamil Nadu",
  "29": "Karnataka",
  "32": "Kerala",
  "28": "Andhra Pradesh",
  "27": "Maharashtra",
};

// ─── TN city pool with exact city-level counts for 680 TN clients ────────────
// 450 Coimbatore, 80 Erode, 60 Tiruppur, 50 Salem, 40 Chennai, rest other TN
// "rest other TN" = 680 - (450+80+60+50+40) = 0 → even split, so we enumerate

function buildTnCitySlots(): string[] {
  const pool: string[] = [];
  for (let i = 0; i < 450; i++) pool.push("Coimbatore");
  for (let i = 0; i < 80; i++) pool.push("Erode");
  for (let i = 0; i < 60; i++) pool.push("Tiruppur");
  for (let i = 0; i < 50; i++) pool.push("Salem");
  for (let i = 0; i < 40; i++) pool.push("Chennai");
  return pool; // exactly 680
}

// ─── Extra Indian names for non-TN clients ───────────────────────────────────

const FIRST_NAMES_EXTRA = [
  "Arun", "Rahul", "Priya", "Sneha", "Arjun", "Kavitha", "Vijay", "Neha",
  "Ramesh", "Sunita", "Dinesh", "Rekha", "Ashok", "Mamta", "Suresh", "Geeta",
  "Mohan", "Indira", "Rajan", "Shalini",
];
const LAST_NAMES_EXTRA = [
  "Patel", "Sharma", "Nair", "Menon", "Reddy", "Rao", "Pillai", "Gupta",
  "Mehta", "Shah", "Verma", "Singh", "Das", "Kumar", "Iyer", "Nambiar",
];

const KA_FIRST = ["Suresh", "Rekha", "Mahesh", "Suma", "Rajesh", "Geetha", "Naveen", "Divya"];
const KA_LAST  = ["Gowda", "Reddy", "Rao", "Naik", "Shetty", "Hegde", "Nair", "Kumar"];

const KL_FIRST = ["Rajesh", "Priya", "Suresh", "Anitha", "Arun", "Lekha", "Manoj", "Sindhu"];
const KL_LAST  = ["Menon", "Nair", "Pillai", "Varma", "Kurup", "Krishnan", "Thomas", "Joseph"];

const AP_FIRST = ["Venkat", "Lakshmi", "Ravi", "Padma", "Srinivas", "Usha", "Prasad", "Asha"];
const AP_LAST  = ["Reddy", "Rao", "Naidu", "Sharma", "Murthy", "Chandra", "Varma", "Babu"];

const MH_FIRST = ["Rahul", "Priya", "Amit", "Sneha", "Vijay", "Sunita", "Suresh", "Pooja"];
const MH_LAST  = ["Patil", "Deshmukh", "Joshi", "Kulkarni", "More", "Shinde", "Kadam", "Sawant"];

// ─── AP / MH cities ──────────────────────────────────────────────────────────

const AP_CITIES = ["Vijayawada", "Visakhapatnam", "Guntur", "Tirupati", "Nellore"];
const MH_CITIES = ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"];

// ─── Pincode ranges per state ─────────────────────────────────────────────────

function makePincode(rng: () => number, stateCode: string): string {
  if (stateCode === "33") return String(600001 + Math.floor(rng() * 41099));
  if (stateCode === "29") return String(560001 + Math.floor(rng() * 10000));
  if (stateCode === "32") return String(682001 + Math.floor(rng() * 8000));
  if (stateCode === "28") return String(520001 + Math.floor(rng() * 10000));
  if (stateCode === "27") return String(400001 + Math.floor(rng() * 20000));
  return String(600001 + Math.floor(rng() * 41099));
}

// ─── Type distribution — exact counts summing to 1000 ────────────────────────
// 700 HOMEOWNER, 100 BUILDER, 80 COMMERCIAL, 60 INTERIOR_DESIGNER, 40 ARCHITECT, 20 GOVERNMENT

type ClientTypeLiteral =
  | "HOMEOWNER"
  | "ARCHITECT"
  | "INTERIOR_DESIGNER"
  | "BUILDER"
  | "COMMERCIAL"
  | "GOVERNMENT"
  | "DEALER";

function buildTypeSlots(): ClientTypeLiteral[] {
  const slots: ClientTypeLiteral[] = [];
  for (let i = 0; i < 700; i++) slots.push("HOMEOWNER");
  for (let i = 0; i < 100; i++) slots.push("BUILDER");
  for (let i = 0; i < 80; i++) slots.push("COMMERCIAL");
  for (let i = 0; i < 60; i++) slots.push("INTERIOR_DESIGNER");
  for (let i = 0; i < 40; i++) slots.push("ARCHITECT");
  for (let i = 0; i < 20; i++) slots.push("GOVERNMENT");
  return slots; // exactly 1000
}

// ─── priceTier from type ──────────────────────────────────────────────────────

function priceTierFor(type: ClientTypeLiteral): string {
  if (type === "HOMEOWNER" || type === "DEALER") return "RETAIL";
  if (type === "BUILDER" || type === "COMMERCIAL" || type === "GOVERNMENT") return "PROJECT";
  // ARCHITECT, INTERIOR_DESIGNER
  return "ARCHITECT";
}

// ─── creditLimit from type ────────────────────────────────────────────────────

function creditLimitFor(rng: ReturnType<typeof makeRng>, type: ClientTypeLiteral): bigint {
  switch (type) {
    case "HOMEOWNER":
    case "DEALER":
      return 0n;
    case "BUILDER":
      return BigInt(rng.int(5, 50) * 10000 * 100); // ₹50k–₹5L in paise
    case "COMMERCIAL":
      return BigInt(rng.int(5, 50) * 10000 * 100); // same range
    case "ARCHITECT":
    case "INTERIOR_DESIGNER":
      return BigInt(rng.int(5, 50) * 10000 * 100); // ₹50k–₹5L in paise
    case "GOVERNMENT":
      return BigInt(rng.int(5, 50) * 10000 * 100);
    default:
      return 0n;
  }
}

// ─── hasGstin for types that should have it ──────────────────────────────────

function businessType(type: ClientTypeLiteral): boolean {
  return type !== "HOMEOWNER" && type !== "DEALER";
}

// ─── State slot builder — exact counts ───────────────────────────────────────
// 680 TN, 150 KA, 100 KL, 35 AP, 35 MH  → 1000 total

function buildStateSlots(): string[] {
  const slots: string[] = [];
  for (let i = 0; i < 680; i++) slots.push(STATE_CODES.TN);
  for (let i = 0; i < 150; i++) slots.push(STATE_CODES.KA);
  for (let i = 0; i < 100; i++) slots.push(STATE_CODES.KL);
  for (let i = 0; i < 35; i++) slots.push(STATE_CODES.AP);
  for (let i = 0; i < 35; i++) slots.push(STATE_CODES.MH);
  return slots; // exactly 1000
}

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

// ─── Name generation per state ───────────────────────────────────────────────

function pickName(
  rng: ReturnType<typeof makeRng>,
  stateCode: string,
): string {
  switch (stateCode) {
    case STATE_CODES.TN: {
      const first = rng.pick(FIRST_NAMES_TN);
      const last = rng.pick(LAST_NAMES_TN);
      return `${first} ${last}`;
    }
    case STATE_CODES.KA: {
      const first = rng.pick(KA_FIRST);
      const last = rng.pick(KA_LAST);
      return `${first} ${last}`;
    }
    case STATE_CODES.KL: {
      const first = rng.pick(KL_FIRST);
      const last = rng.pick(KL_LAST);
      return `${first} ${last}`;
    }
    case STATE_CODES.AP: {
      const first = rng.pick(AP_FIRST);
      const last = rng.pick(AP_LAST);
      return `${first} ${last}`;
    }
    case STATE_CODES.MH: {
      const first = rng.pick(MH_FIRST);
      const last = rng.pick(MH_LAST);
      return `${first} ${last}`;
    }
    default: {
      const first = rng.pick(FIRST_NAMES_EXTRA);
      const last = rng.pick(LAST_NAMES_EXTRA);
      return `${first} ${last}`;
    }
  }
}

// ─── City per state ──────────────────────────────────────────────────────────

function pickCity(rng: ReturnType<typeof makeRng>, stateCode: string, tnPool: string, tnIdx: number): string {
  switch (stateCode) {
    case STATE_CODES.TN:
      return tnPool; // pre-assigned from the slot
    case STATE_CODES.KA:
      return rng.pick(KA_CITIES);
    case STATE_CODES.KL:
      return rng.pick(KL_CITIES);
    case STATE_CODES.AP:
      return rng.pick(AP_CITIES);
    case STATE_CODES.MH:
      return rng.pick(MH_CITIES);
    default:
      return rng.pick(TN_CITIES);
  }
  // tnIdx is unused but kept for potential future use; suppress via void
  void tnIdx;
}

// ─── createdAt: spread over last 36 months ───────────────────────────────────

function makeCreatedAt(rng: ReturnType<typeof makeRng>): Date {
  const now = new Date();
  const daysBack = rng.int(0, 36 * 30); // up to 3 years ago
  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  d.setHours(rng.int(8, 18), rng.int(0, 59), 0, 0);
  return d;
}

// ─── Return type ─────────────────────────────────────────────────────────────

export interface SeedCustomerResult {
  clientIds: string[];
  architectIds: string[];
  architectIdList: string[];
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function seedCustomers(
  db: PrismaClient,
  organizationId: string,
  seed = 99,
): Promise<SeedCustomerResult> {
  const rng = makeRng(seed);

  // ── 1. BUILD ARCHITECTS ──────────────────────────────────────────────────
  const COMMISSION_PCTS = [5.0, 7.5, 10.0, 12.5];
  const architectRows: Prisma.ArchitectCreateManyInput[] = [];
  const architectIdList: string[] = [];

  for (let i = 0; i < 40; i++) {
    const id = randomUUID();
    architectIdList.push(id);

    // Cycle the 20 firm names; for 21–40 add " Associates" / " Studio" variants
    const baseFirm = ARCHITECT_FIRMS[i % ARCHITECT_FIRMS.length]!;
    const firmName = i < 20 ? baseFirm : `${baseFirm} ${rng.pick(["Associates", "Studio", "Design Group"] as const)}`;

    const contactFirst = rng.pick(FIRST_NAMES_TN);
    const contactLast = rng.pick(LAST_NAMES_TN);
    const mobileSuffix = String(rng.int(700000000, 999999999)).padStart(9, "0");

    architectRows.push({
      id,
      organizationId,
      code: `ARC-${String(i + 1).padStart(3, "0")}`,
      firmName,
      contactName: `${contactFirst} ${contactLast}`,
      mobile: `+91 9${mobileSuffix}`,
      email: rng.boolean(0.7)
        ? `${contactFirst.toLowerCase()}.${contactLast.toLowerCase()}@${baseFirm.toLowerCase().replace(/\s+/g, "")}.com`
        : null,
      commissionPct: new Prisma.Decimal(rng.pick(COMMISSION_PCTS)),
      address: {
        line1: `${rng.int(1, 200)} ${rng.pick(["Layout", "Colony", "Street", "Nagar"] as const)}`,
        city: rng.pick(TN_CITIES),
        state: "Tamil Nadu",
        stateCode: "33",
        pincode: makePincode(rng.next, "33"),
      },
      isActive: true,
    });
  }

  await db.architect.createMany({ data: architectRows });

  // ── 2. BUILD CLIENTS (1000) ──────────────────────────────────────────────

  const total = 1000;
  const tnCitySlots = shuffle(buildTnCitySlots(), rng.next);
  const typeSlots   = shuffle(buildTypeSlots(), rng.next);
  const stateSlots  = shuffle(buildStateSlots(), rng.next);

  // 200 clients will be linked to an architect
  const architectLinkedSet = new Set<number>();
  while (architectLinkedSet.size < 200) {
    architectLinkedSet.add(rng.int(0, total - 1));
  }

  // Road types for address line1
  const ROAD_TYPES = ["Main Road", "Cross Street", "Nagar", "Colony", "Layout", "Avenue"] as const;

  const clientRows: Prisma.ClientCreateManyInput[] = [];
  const clientIds: string[] = [];

  let tnCityIdx = 0;

  for (let i = 0; i < total; i++) {
    const id = randomUUID();
    clientIds.push(id);

    const stateCode = stateSlots[i]!;
    const type = typeSlots[i]!;
    const isBusiness = businessType(type);

    const name = pickName(rng, stateCode);

    // city: for TN clients consume from the pre-shuffled tnCitySlots sequentially
    const city = stateCode === STATE_CODES.TN
      ? tnCitySlots[tnCityIdx++]!
      : pickCity(rng, stateCode, "", i);

    const stateName = STATE_NAMES[stateCode] ?? "Tamil Nadu";
    const pincode = makePincode(rng.next, stateCode);

    const billingAddress = {
      line1: `${rng.int(1, 999)} ${rng.pick(ROAD_TYPES)}`,
      city,
      state: stateName,
      stateCode,
      pincode,
    };

    const hasGstin = isBusiness;
    const gstin = hasGstin ? makeGstin(rng.next, stateCode) : null;
    const pan   = hasGstin ? makePan(rng.next) : null;

    const mobileSuffix = String(rng.int(700000000, 999999999)).padStart(9, "0");
    const mobile = `+91 9${mobileSuffix}`;

    const hasAltMobile = rng.boolean(0.25);
    const altSuffix = String(rng.int(700000000, 999999999)).padStart(9, "0");

    const architectId = architectLinkedSet.has(i)
      ? architectIdList[rng.int(0, architectIdList.length - 1)]!
      : null;

    const createdAt = makeCreatedAt(rng);

    clientRows.push({
      id,
      organizationId,
      code: `CLT-${String(i + 1).padStart(4, "0")}`,
      name,
      type,
      gstin,
      pan,
      mobile,
      altMobile: hasAltMobile ? `+91 9${altSuffix}` : null,
      email: rng.boolean(isBusiness ? 0.7 : 0.4)
        ? `${name.split(" ")[0]!.toLowerCase()}${i}@example.com`
        : null,
      billingAddress,
      priceTier: priceTierFor(type),
      creditLimit: creditLimitFor(rng, type),
      architectId,
      notes: null,
      createdAt,
    });
  }

  await db.client.createMany({ data: clientRows });

  // ── 3. BUILD CONTACT PERSONS (200 clients) ───────────────────────────────
  // Create one ContactPerson for every 5th client (200 total = 20%)

  const contactRows: Prisma.ContactPersonCreateManyInput[] = [];

  for (let i = 0; i < total; i += 5) {
    const clientId = clientIds[i];
    if (!clientId) continue;

    const stateCode = stateSlots[i]!;
    const contactName = pickName(rng, stateCode);
    const contactSuffix = String(rng.int(700000000, 999999999)).padStart(9, "0");

    const DESIGNATIONS = [
      "Owner", "Manager", "Purchase Head", "Accounts", "Site Supervisor", "MD",
    ] as const;

    contactRows.push({
      organizationId,
      clientId,
      name: contactName,
      designation: rng.pick(DESIGNATIONS),
      mobile: `+91 9${contactSuffix}`,
      email: rng.boolean(0.5) ? `${contactName.split(" ")[0]!.toLowerCase()}${i}@example.com` : null,
      whatsappOptIn: rng.boolean(0.9),
    });
  }

  await db.contactPerson.createMany({ data: contactRows });

  return {
    clientIds,
    architectIds: architectIdList,
    architectIdList,
  };
}
