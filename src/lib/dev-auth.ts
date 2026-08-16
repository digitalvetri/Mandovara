"use server";

// Real password auth. Signed HMAC session cookie. No dev bypasses.
//
// - devLoginByCredential: email/mobile + password, bcrypt-verified against
//   User.passwordHash. Users with no hash cannot log in.
// - devLogout: clears the session cookie.
// - devLogin(role): DELETED. Was a "pick any user with role X and become them"
//   shortcut — a giant impersonation hole. Callers now must supply a password.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/kernel/db/client";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./session";

export interface LoginResult { ok: boolean; error?: string }

// Deliberately generic error to prevent user enumeration.
const GENERIC_ERR = "Invalid email/mobile or password";

export async function devLoginByCredential(
  credential: string,
  password: string,
): Promise<LoginResult> {
  const q = credential.trim();
  if (!q || !password) {
    return { ok: false, error: "Enter your email/mobile and password" };
  }

  try {
    let user = await prisma.user.findFirst({
      where: { email: q.toLowerCase() },
      select: { id: true, passwordHash: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { mobile: q },
        select: { id: true, passwordHash: true, status: true },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!user) return { ok: false, error: GENERIC_ERR };
    if (user.status !== "ACTIVE") {
      return { ok: false, error: "This account is suspended. Contact your administrator." };
    }
    if (!user.passwordHash) {
      // A user exists but has no password set — refuse (was silently accepted before).
      return { ok: false, error: "This account has no password set. Contact your administrator." };
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { ok: false, error: GENERIC_ERR };

    const signed = await signSession(user.id);
    const jar = await cookies();
    // COOKIE_SECURE controls the Secure flag independently of NODE_ENV so we
    // can run in production over plain HTTP (e.g. sslip.io test URLs before
    // TLS is set up). Default: on unless explicitly disabled. Browsers refuse
    // to store Secure cookies over HTTP, so leaving this on when serving
    // plain HTTP breaks login silently.
    const cookieSecure = process.env["COOKIE_SECURE"] !== "false"
      && process.env["NODE_ENV"] === "production";
    jar.set(SESSION_COOKIE, signed, {
      httpOnly: true,
      secure: cookieSecure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
      sameSite: "lax",
    });
    return { ok: true };
  } catch (e) {
    console.error("[auth] loginByCredential failed:", e);
    return { ok: false, error: "Login failed — please try again in a moment" };
  }
}

export async function devLogout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
