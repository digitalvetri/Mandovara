// Regression guard: every login path must issue an HMAC-SIGNED cookie.
//
// The mobile + PIN login that motivated this test has since been removed, but
// the guard is worth keeping: it pins the contract that a bare user id is
// never an acceptable session cookie, so a future login path cannot repeat the
// mistake of setting one.

import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession } from "@/lib/session";

const USER_ID = "clx1234567890abcdefghijkl"; // a cuid, as stored on User.id

describe("session cookie", () => {
  beforeAll(() => {
    process.env["SESSION_SECRET"] ??= "0".repeat(64);
  });

  it("a signed cookie round-trips to the user id", async () => {
    expect(await verifySession(await signSession(USER_ID))).toBe(USER_ID);
  });

  it("a bare user id is REJECTED — this is the PIN-login bug", async () => {
    expect(await verifySession(USER_ID)).toBeNull();
  });

  it("a tampered signature is rejected", async () => {
    const good = await signSession(USER_ID);
    const bad  = `${good.slice(0, -1)}${good.endsWith("A") ? "B" : "A"}`;
    expect(await verifySession(bad)).toBeNull();
  });

  it("a swapped user id is rejected", async () => {
    const mac = (await signSession(USER_ID)).split(".").pop();
    expect(await verifySession(`someoneelse.${mac}`)).toBeNull();
  });

  it("empty and malformed cookies are rejected", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession(".")).toBeNull();
    expect(await verifySession("noDotHere")).toBeNull();
    expect(await verifySession("trailingdot.")).toBeNull();
  });
});
