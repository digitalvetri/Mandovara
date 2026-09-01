// The guard that stands between a script and an empty studio.
//
// The version this replaces asked whether NEXT_PUBLIC_APP_URL contained
// "mandovara.com". The app runs on mandovara.sbs, so it never fired
// where it mattered, and nothing in the suite noticed. These tests exist
// so the next silent rot is a red build.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isLocalDatabase, wipeConfirmed, assertWipeAllowed, hostOf,
} from "../../scripts/lib/db-target.mjs";

const KEYS = ["DATABASE_URL", "DIRECT_URL", "CONFIRM_WIPE", "NEXT_PUBLIC_APP_URL"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const populated = () => Promise.resolve(3);
const empty     = () => Promise.resolve(0);

describe("isLocalDatabase", () => {
  it("recognises a developer's machine and CI", () => {
    for (const host of ["localhost", "127.0.0.1"]) {
      process.env["DATABASE_URL"] = `postgresql://u:p@${host}:5432/mandovara`;
      expect(isLocalDatabase()).toBe(true);
    }
  });

  it("treats any remote host as production", () => {
    for (const url of [
      "postgresql://u:p@db.mandovara.sbs:5432/mandovara",
      "postgresql://u:p@10.0.0.4:5432/mandovara",
      "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    ]) {
      process.env["DATABASE_URL"] = url;
      expect(isLocalDatabase()).toBe(false);
    }
  });

  it("does NOT trust a container service name", () => {
    // "postgres" is the compose service name locally AND a plausible
    // service name in a production stack. Treating it as local is the
    // exact class of mistake this guard exists to correct.
    process.env["DATABASE_URL"] = "postgresql://u:p@postgres:5432/mandovara";
    expect(isLocalDatabase()).toBe(false);
  });

  it("fails closed when there is no usable connection string", () => {
    expect(isLocalDatabase()).toBe(false);
    process.env["DATABASE_URL"] = "not a url";
    expect(isLocalDatabase()).toBe(false);
  });

  it("prefers DIRECT_URL, which is what the destructive scripts write through", () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/mandovara";
    process.env["DIRECT_URL"]   = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    expect(isLocalDatabase()).toBe(false);
  });
});

describe("assertWipeAllowed", () => {
  it("refuses a populated remote database", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    await expect(assertWipeAllowed(populated, "wipe()")).rejects.toThrow(/refused/);
  });

  it("names the host and the cost in the refusal", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    await expect(assertWipeAllowed(populated)).rejects.toThrow(/db\.mandovara\.sbs.*3 organization/s);
  });

  it("allows a local database to be wiped freely", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:15432/mandovara";
    await expect(assertWipeAllowed(populated)).resolves.toBeUndefined();
  });

  it("allows an EMPTY remote database — a fresh deploy seeding itself", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    await expect(assertWipeAllowed(empty)).resolves.toBeUndefined();
  });

  it("allows a deliberate, confirmed production wipe", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    process.env["CONFIRM_WIPE"] = "I_UNDERSTAND";
    await expect(assertWipeAllowed(populated)).resolves.toBeUndefined();
  });

  it("is not fooled by a near-miss confirmation", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    for (const v of ["yes", "true", "i_understand", "I_UNDERSTAND "]) {
      process.env["CONFIRM_WIPE"] = v;
      expect(wipeConfirmed()).toBe(false);
      await expect(assertWipeAllowed(populated)).rejects.toThrow(/refused/);
    }
  });

  it("ignores NEXT_PUBLIC_APP_URL entirely", async () => {
    // The old guard keyed off this cosmetic display URL. Changing it must
    // not change whether production data can be destroyed.
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000";
    await expect(assertWipeAllowed(populated)).rejects.toThrow(/refused/);
  });

  it("refuses when it cannot reach the database to ask", async () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    const unreachable = () => Promise.reject(new Error("Can't reach database server"));
    await expect(assertWipeAllowed(unreachable)).rejects.toThrow(/cannot verify/);
  });

  it("does not even count rows when the answer cannot change", async () => {
    // A local wipe must not need a working connection to proceed.
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/mandovara";
    const boom = () => Promise.reject(new Error("should not be called"));
    await expect(assertWipeAllowed(boom)).resolves.toBeUndefined();
  });
});

describe("hostOf", () => {
  it("reports something useful in the refusal message", () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@db.mandovara.sbs:5432/mandovara";
    expect(hostOf()).toBe("db.mandovara.sbs");
    process.env["DATABASE_URL"] = "not a url";
    expect(hostOf()).toBe("(unparseable DATABASE_URL)");
  });
});
