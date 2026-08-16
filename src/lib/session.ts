// HMAC-SHA256 signed session cookie.
// Works in both Node and Edge runtimes via Web Crypto (needed for middleware).
//
// Cookie format: <userId>.<base64url-hmac>
//
// Rotating SESSION_SECRET invalidates every active session — deliberate,
// use when a secret leaks.

const COOKIE_NAME = "mv_sess";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function requireSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  if (s.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return s;
}

async function hmacBase64Url(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE;

export async function signSession(userId: string): Promise<string> {
  if (!userId) throw new Error("userId is empty");
  const mac = await hmacBase64Url(userId, requireSecret());
  return `${userId}.${mac}`;
}

/** Returns the userId if the cookie signature is valid, otherwise null. */
export async function verifySession(cookie: string | undefined | null): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const userId = cookie.slice(0, dot);
  const provided = cookie.slice(dot + 1);
  let expected: string;
  try {
    expected = await hmacBase64Url(userId, requireSecret());
  } catch {
    return null; // SESSION_SECRET not configured — never trust
  }
  if (provided.length !== expected.length) return null;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? userId : null;
}
