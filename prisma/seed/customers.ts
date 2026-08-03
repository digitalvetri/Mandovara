import { Prisma, PrismaClient } from "@prisma/client";
import { COMPANY_SUFFIXES, FIRST_NAMES_TN, KA_CITIES, KL_CITIES, STATE_CODES, TN_CITIES } from "./data";
import { makeGstin, makePan, makeRng } from "./rng";

export async function seedCustomers(db: PrismaClient, orgId: string, seed = 44) {
  const rng = makeRng(seed);
  const total = 800;

  const clientRows: Prisma.ClientCreateManyInput[] = [];
  for (let i = 0; i < total; i++) {
    const first = FIRST_NAMES_TN[rng.int(0, FIRST_NAMES_TN.length - 1)]!;
    const suffix = COMPANY_SUFFIXES[rng.int(0, COMPANY_SUFFIXES.length - 1)]!;
    const stateCode = rng.weighted([[STATE_CODES.TN, 70], [STATE_CODES.KA, 20], [STATE_CODES.KL, 10]]);
    const type = rng.weighted<Prisma.ClientCreateManyInput["type"]>([
      ["DEALER", 30], ["DISTRIBUTOR", 15], ["RETAIL", 25], ["PROJECT", 25], ["GOVERNMENT", 5],
    ]);
    const hasGstin = type !== "RETAIL" || rng.boolean(0.3);
    clientRows.push({
      orgId,
      name: `${first} ${suffix} #${1001 + i}`,
      gstin: hasGstin ? makeGstin(rng.next, stateCode) : null,
      pan: hasGstin ? makePan(rng.next) : null,
      type,
      status: rng.weighted<Prisma.ClientCreateManyInput["status"]>([
        ["ACTIVE", 90], ["INACTIVE", 8], ["BLACKLISTED", 2],
      ]),
      stateCode,
      primaryMobile: `+91${9400000000 + i * 100 + rng.int(0, 99)}`,
      primaryEmail: rng.boolean(0.6) ? `${first.toLowerCase()}${i}@example.com` : null,
      paymentTerms: rng.pick([15, 30, 45, 60, 90]),
    });
  }
  await db.client.createMany({ data: clientRows });
  const clients = await db.client.findMany({
    where: { orgId },
    select: { id: true, stateCode: true, type: true, name: true, primaryMobile: true },
  });

  const contacts: Prisma.ContactPersonCreateManyInput[] = [];
  const addresses: Prisma.AddressCreateManyInput[] = [];
  const creditRows: Prisma.CreditLimitCreateManyInput[] = [];

  for (const c of clients) {
    contacts.push({
      clientId: c.id, name: c.name.split(" ")[0]!, role: "OWNER",
      mobile: c.primaryMobile, isPrimary: true,
    });
    if (rng.boolean(0.4)) {
      contacts.push({
        clientId: c.id,
        name: FIRST_NAMES_TN[rng.int(0, FIRST_NAMES_TN.length - 1)]!,
        role: rng.pick<Prisma.ContactPersonCreateManyInput["role"]>(["PURCHASE", "ACCOUNTS", "SITE"]),
        mobile: `+91${9200000000 + rng.int(0, 9_999_999)}`,
      });
    }
    const cityPool = c.stateCode === STATE_CODES.TN ? TN_CITIES
                   : c.stateCode === STATE_CODES.KA ? KA_CITIES : KL_CITIES;
    addresses.push({
      clientId: c.id, label: "Billing",
      line1: `${rng.int(1, 999)} ${rng.pick(["Market", "Main", "Ring", "Bypass"])} Road`,
      city: cityPool[rng.int(0, cityPool.length - 1)]!,
      stateCode: c.stateCode,
      pincode: String(rng.int(600001, 641099)),
      isDefault: true,
    });
    const limit = c.type === "PROJECT"     ? BigInt(rng.int(10, 50) * 100_000 * 100)
                : c.type === "DISTRIBUTOR" ? BigInt(rng.int(5, 20) * 100_000 * 100)
                : c.type === "DEALER"      ? BigInt(rng.int(1, 5) * 100_000 * 100)
                                           : BigInt(rng.int(10, 100) * 1_000 * 100);
    creditRows.push({ clientId: c.id, limitPaise: limit });
  }
  await db.contactPerson.createMany({ data: contacts });
  await db.address.createMany({ data: addresses });
  await db.creditLimit.createMany({ data: creditRows });

  return { clients };
}
