"use server";

// Real password auth. Signed HMAC session cookie. No dev bypasses.
//
// - devLoginByCredential: email/mobile + password, bcrypt-verified against
//   User.passwordHash. Users with no hash cannot log in.
// - changePassword: authenticated user rotates their own password. Clears
//   the mustChangePassword flag on success.
// - devLogout: clears the session cookie.
// - devLogin(role): DELETED. Was a "pick any user with role X and become them"
//   shortcut — a giant impersonation hole. Callers now must supply a password.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/kernel/db/client";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

export interface LoginResult {
  ok: boolean;
  error?: string;
  /** Set by devLoginByCredential when the user must rotate their password. */
  mustChangePassword?: boolean;
  /** The logged-in user's role — used by the client to pick the right landing page. */
  role?: string;
}

// Deliberately generic error to prevent user enumeration.
const GENERIC_ERR = "Invalid email/mobile or password";

const MIN_PASSWORD_LEN = 10;

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
      select: { id: true, passwordHash: true, status: true, mustChangePassword: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { mobile: q },
        select: { id: true, passwordHash: true, status: true, mustChangePassword: true, role: true },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!user) return { ok: false, error: GENERIC_ERR };
    if (user.status !== "ACTIVE") {
      return { ok: false, error: "This account is suspended. Contact your administrator." };
    }
    if (!user.passwordHash) {
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

    // Fire-and-forget lastLoginAt update — non-blocking, don't fail login
    // if this write hiccups.
    prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err) => console.error("[auth] lastLoginAt update failed:", err));

    return { ok: true, mustChangePassword: user.mustChangePassword, role: user.role };
  } catch (e) {
    console.error("[auth] loginByCredential failed:", e);
    return { ok: false, error: "Login failed — please try again in a moment" };
  }
}

export async function loginByMobilePin(
  mobile: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env["NODE_ENV"] === "production" && process.env["ALLOW_DEV_AUTH"] !== "true") {
    return { ok: false, error: "Auth disabled in production" };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: "PIN must be exactly 4 digits" };
  }

  // Normalize: strip spaces, ensure +91 prefix
  const digits = mobile.replace(/\D/g, "");
  const normalized =
    digits.length === 10 ? `+91${digits}` :
    digits.length === 12 && digits.startsWith("91") ? `+${digits}` :
    mobile.trim();

  try {
    const user = await prisma.user.findFirst({
      where: { mobile: normalized },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return { ok: false, error: "No account found for this mobile number" };
    }

    if (!user.passwordHash) {
      return { ok: false, error: "PIN not set for this account. Contact admin." };
    }

    const valid = await bcrypt.compare(pin, user.passwordHash);
    if (!valid) return { ok: false, error: "Incorrect PIN" };

    const jar = await cookies();
    jar.set(SESSION_COOKIE, user.id, { httpOnly: true, path: "/", maxAge: SESSION_MAX_AGE, sameSite: "lax" });
    return { ok: true };
  } catch {
    return { ok: false, error: "Database unavailable — check DATABASE_URL" };
  }
}

export async function devLogout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Authenticated password change. Reads the user from the session cookie
 * (no need to trust a form-supplied user id), verifies the current password,
 * enforces a minimum length + "must be different" policy, and clears the
 * mustChangePassword flag.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResult> {
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Both current and new password are required" };
  }
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LEN} characters` };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "New password must differ from the current one" };
  }

  try {
    const jar = await cookies();
    const uid = await verifySession(jar.get(SESSION_COOKIE)?.value);
    if (!uid) return { ok: false, error: "Session expired — please sign in again" };

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return { ok: false, error: "Account not found or suspended" };
    }
    if (!user.passwordHash) {
      return { ok: false, error: "This account has no password set" };
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect" };

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });
    return { ok: true };
  } catch (e) {
    console.error("[auth] changePassword failed:", e);
    return { ok: false, error: "Could not change password — please try again" };
  }
}
