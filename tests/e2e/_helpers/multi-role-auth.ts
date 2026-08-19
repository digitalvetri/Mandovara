// Shared helper: create a browser context that's already logged in as one
// of the 9 seeded role users. Used by the RBAC matrix spec.
//
// Skips the UI login entirely: reads the seeded user, forces
// mustChangePassword=false, and plants a signed session cookie directly.
// This is a *test* backdoor — the cookie is signed with the same secret
// the app uses, so it's identical to what a real login would produce.

import type { BrowserContext, Browser } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Minimal .env loader — reads SESSION_SECRET from the project root .env
// so tests don't depend on dotenv being installed. Only invoked once.
function loadEnvOnce() {
  if (process.env["SESSION_SECRET"]) return;
  const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2]!;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = val;
  }
}
loadEnvOnce();

export type SeedRole =
  | "OWNER" | "DESIGNER" | "SALES" | "MEASURE_EXEC"
  | "STORE" | "MAKE_SUPERVISOR" | "INSTALLER" | "ACCOUNTS" | "HR";

const TEMP_PWD = "Mandovara@2026";
const SESSION_COOKIE = "mv_sess";

export const ROLE_USERS: Record<SeedRole, { email: string }> = {
  OWNER:          { email: "rohit@mandovara.com"     },
  DESIGNER:       { email: "aishwarya@mandovara.com" },
  SALES:          { email: "karthik@mandovara.com"   },
  MEASURE_EXEC:   { email: "bala@mandovara.com"      },
  STORE:          { email: "senthil@mandovara.com"   },
  MAKE_SUPERVISOR:{ email: "manoj@mandovara.com"     },
  INSTALLER:      { email: "vignesh@mandovara.com"   },
  ACCOUNTS:       { email: "deepa@mandovara.com"     },
  HR:             { email: "priya@mandovara.com"     },
};

async function hmacBase64Url(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signSession(userId: string): Promise<string> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET missing/short — check .env is loaded");
  }
  const mac = await hmacBase64Url(userId, secret);
  return `${userId}.${mac}`;
}

// Cache the user-id-by-role lookup so we don't hammer the DB.
let cachedIds: Partial<Record<SeedRole, string>> = {};

async function getUserId(role: SeedRole): Promise<string> {
  if (cachedIds[role]) return cachedIds[role]!;
  const db = new PrismaClient();
  try {
    const u = await db.user.findFirstOrThrow({
      where: { email: ROLE_USERS[role].email },
      select: { id: true },
    });
    // Ensure the user is not blocked by the mustChangePassword gate.
    await db.user.update({
      where: { id: u.id },
      data: { mustChangePassword: false },
    });
    cachedIds[role] = u.id;
    return u.id;
  } finally {
    await db.$disconnect();
  }
}

// Return a fresh context with a signed session cookie for the given role.
export async function loginAs(browser: Browser, role: SeedRole): Promise<BrowserContext> {
  const userId = await getUserId(role);
  const token = await signSession(userId);

  const context = await browser.newContext();
  await context.addCookies([{
    name:     SESSION_COOKIE,
    value:    token,
    domain:   "localhost",
    path:     "/",
    httpOnly: true,
    secure:   false,
    sameSite: "Lax",
    expires:  Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
  }]);
  return context;
}

// Restore every role user to seed defaults (temp password + must-change flag)
// so humans can sign in normally after the test run.
export async function resetAllRoleUsersToSeed() {
  const db = new PrismaClient();
  try {
    const hash = bcrypt.hashSync(TEMP_PWD, 10);
    for (const { email } of Object.values(ROLE_USERS)) {
      const u = await db.user.findFirst({ where: { email }, select: { id: true } });
      if (!u) continue;
      await db.user.update({
        where: { id: u.id },
        data: { passwordHash: hash, mustChangePassword: true },
      });
    }
    cachedIds = {};
  } finally {
    await db.$disconnect();
  }
}
