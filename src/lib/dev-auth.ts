"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/kernel/db/client";
import type { AppRole } from "@/kernel/db/client";

const COOKIE = "dev_uid";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const VALID_ROLES: readonly string[] = [
  "OWNER", "DESIGNER", "SALES", "MEASURE_EXEC",
  "STORE", "MAKE_SUPERVISOR", "INSTALLER", "ACCOUNTS", "HR",
];

export async function devLogin(role: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env["NODE_ENV"] === "production") {
    return { ok: false, error: "Dev auth disabled in production" };
  }
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role" };
  }

  try {
    const user = await prisma.user.findFirst({
      where: { role: role as AppRole },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!user) return { ok: false, error: `No user with role ${role} found — run pnpm db:seed first` };

    const jar = await cookies();
    jar.set(COOKIE, user.id, { httpOnly: true, path: "/", maxAge: MAX_AGE, sameSite: "lax" });
    return { ok: true };
  } catch {
    return { ok: false, error: "Database unavailable — start Docker / check DATABASE_URL" };
  }
}

export async function devLoginByCredential(
  credential: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env["NODE_ENV"] === "production") {
    return { ok: false, error: "Dev auth disabled in production" };
  }

  try {
    const q = credential.trim();
    let user = await prisma.user.findFirst({
      where: { email: q.toLowerCase() },
      select: { id: true, passwordHash: true },
      orderBy: { createdAt: "asc" },
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { mobile: q },
        select: { id: true, passwordHash: true },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!user) {
      return {
        ok: false,
        error: "No account found with this email or mobile number",
      };
    }

    // Verify password if a hash is stored; otherwise fall back to any-value (dev convenience)
    if (user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return { ok: false, error: "Incorrect password" };
    }

    const jar = await cookies();
    jar.set(COOKIE, user.id, { httpOnly: true, path: "/", maxAge: MAX_AGE, sameSite: "lax" });
    return { ok: true };
  } catch {
    return { ok: false, error: "Database unavailable — start Docker / check DATABASE_URL" };
  }
}

export async function devLogout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
