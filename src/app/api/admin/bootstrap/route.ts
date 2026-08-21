// One-time production bootstrap — creates the Mandovara org, branch, and users
// if the database is empty. Safe to call repeatedly (fully idempotent).
// Gated by the same IMPORT_TOKEN as /api/admin/import-stock.
//
// Usage:
//   curl -X POST https://<host>/api/admin/bootstrap \
//        -H "X-Import-Token: $IMPORT_TOKEN"
//
// Returns:
//   { ok, alreadySeeded, orgId, usersCreated, message }
//
// Call this ONCE after first deploy, then call /api/admin/import-stock
// to load the wallpaper / flooring / hardware stock.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authBootstrapPrisma } from "@/kernel/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PASSWORD = "Mandovara@2026";

const USER_SPECS = [
  { role: "OWNER" as const,          name: "Rohit Mandovara",  mobile: "+91 9843012345", email: "rohit@mandovara.com"     },
  { role: "DESIGNER" as const,       name: "Aishwarya Raj",    mobile: "+91 9843012346", email: "aishwarya@mandovara.com" },
  { role: "SALES" as const,          name: "Karthik Suresh",   mobile: "+91 9843012347", email: "karthik@mandovara.com"   },
  { role: "MEASURE_EXEC" as const,   name: "Bala Kumar",       mobile: "+91 9843012348", email: "bala@mandovara.com"      },
  { role: "STORE" as const,          name: "Senthil Murugan",  mobile: "+91 9843012349", email: "senthil@mandovara.com"   },
  { role: "MAKE_SUPERVISOR" as const,name: "Manoj Krishnan",   mobile: "+91 9843012350", email: "manoj@mandovara.com"     },
  { role: "ACCOUNTS" as const,       name: "Deepa Iyer",       mobile: "+91 9843012352", email: "deepa@mandovara.com"     },
  { role: "HR" as const,             name: "Priya Natarajan",  mobile: "+91 9843012353", email: "priya@mandovara.com"     },
] as const;

const ORG_SETTINGS = {
  wastagePct: { FLOORING_STRAIGHT: 7, FLOORING_DIAGONAL: 10, FLOORING_HERRINGBONE: 15, WALLPAPER: 10, CARPET: 10 },
  fullness:   { SHEER: 2.5, MAIN_PINCH_PLEAT: 2.5, MAIN_EYELET: 2.0, MAIN_PENCIL_PLEAT: 2.5 },
  roll:       { widthMm: 530, lengthM: 10.05 },
  blinds:     { insideClearanceMm: 6, outsideOverlapMm: 75, outsideTopOverlapMm: 100, minChargeSqft: 10 },
  curtains:   { sideHemMm: 50, headingAllowanceMm: 150, bottomHemMm: 150, eyeletSpacingMm: 150 },
};

interface BootstrapResult {
  ok:            boolean;
  alreadySeeded: boolean;
  orgId:         string;
  usersCreated:  number;
  message:       string;
}

export async function POST(
  req: Request,
): Promise<NextResponse<BootstrapResult | { error: string }>> {
  const provided = req.headers.get("x-import-token");
  const expected = process.env["IMPORT_TOKEN"];
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = authBootstrapPrisma;

  // ── Idempotency guard ──────────────────────────────────────────────────────
  const existingOrg = await db.organization.findFirst({
    where:  { name: "Mandovara" },
    select: { id: true },
  });
  if (existingOrg) {
    return NextResponse.json({
      ok:            true,
      alreadySeeded: true,
      orgId:         existingOrg.id,
      usersCreated:  0,
      message:       "Org already exists — skipped. Ready for /api/admin/import-stock.",
    });
  }

  // ── Create org ─────────────────────────────────────────────────────────────
  const org = await db.organization.create({
    data: {
      name:        "Mandovara",
      legalName:   "Mandovara Interior Décor",
      city:        "Coimbatore",
      state:       "Tamil Nadu",
      stateCode:   "33",
      pincode:     "641002",
      addressLine: "32 Thirumoorthy Layout, Thadagam Road, RS Puram",
      phone:       "+91 8940430051",
      email:       "mandovara22@gmail.com",
      website:     "https://mandovara.com",
      fyStartMonth: 4,
      settings:    ORG_SETTINGS,
    },
  });

  // ── Create branch ──────────────────────────────────────────────────────────
  await db.branch.create({
    data: {
      organizationId: org.id,
      name:           "RS Puram Showroom",
      stateCode:      "33",
      invoicePrefix:  "MDV",
      address: {
        line:    "32 Thirumoorthy Layout, Thadagam Road",
        area:    "RS Puram",
        city:    "Coimbatore",
        state:   "Tamil Nadu",
        pincode: "641002",
      },
    },
  });

  // ── Create users ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let usersCreated = 0;

  for (const spec of USER_SPECS) {
    await db.user.upsert({
      where: {
        organizationId_mobile: { organizationId: org.id, mobile: spec.mobile },
      },
      update: {},
      create: {
        organizationId: org.id,
        mobile:         spec.mobile,
        email:          spec.email,
        name:           spec.name,
        role:           spec.role,
        passwordHash,
        branchIds:      [],
        status:         "ACTIVE",
      },
    });
    usersCreated++;
  }

  // ── Seed GRN NumberSequence so import scripts can allocate numbers ─────────
  await db.numberSequence.upsert({
    where:  { organizationId_series_yymm: { organizationId: org.id, series: "GRN", yymm: "2608" } },
    update: {},
    create: { organizationId: org.id, series: "GRN", yymm: "2608", counter: 0 },
  });

  return NextResponse.json({
    ok:            true,
    alreadySeeded: false,
    orgId:         org.id,
    usersCreated,
    message:       `Bootstrap complete. Org "${org.id}" created with ${usersCreated} users. Now call /api/admin/import-stock.`,
  });
}
