// "Am I about to destroy real data?"
//
// The guard this replaces asked `NEXT_PUBLIC_APP_URL.includes("mandovara.com")`.
// The studio's app runs on mandovara.sbs — mandovara.com is the WordPress
// marketing site — so the check never fired on the real production app and
// every destructive script believed it was safe. It also keyed off a
// cosmetic display URL, which anyone could change without realising it was
// load-bearing.
//
// This asks the database instead, because the database is the thing at
// risk. Two questions, in order:
//
//   1. Is the connection pointed at this machine? Then it is a developer's
//      box or CI, and wiping is the point.
//   2. Otherwise it is remote — treat it as production and refuse, unless
//      the caller set CONFIRM_WIPE=I_UNDERSTAND, or the database is empty
//      and there is nothing to destroy.
//
// Fails CLOSED: an unparseable or missing connection string counts as
// production. A guard that cannot tell should not give permission.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** The connection a destructive script actually writes through. */
export function databaseUrl() {
  return process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "";
}

/**
 * True only when the connection points at this machine.
 *
 * Deliberately NOT a list of container hostnames. "postgres" and "db" are
 * the compose service names locally, but they are just as likely to be the
 * service name in a production stack — treating them as local is exactly
 * the class of mistake this file exists to correct.
 */
export function isLocalDatabase() {
  try {
    const { hostname } = new URL(databaseUrl());
    return LOCAL_HOSTS.has(hostname);
  } catch {
    return false;                       // unparseable → assume production
  }
}

/** Set deliberately by a human who has read what the script does. */
export function wipeConfirmed() {
  return process.env["CONFIRM_WIPE"] === "I_UNDERSTAND";
}

/**
 * Throw unless it is safe to truncate.
 *
 * `countExistingRows` is passed in rather than imported so this file stays
 * free of Prisma and can be loaded by any script. It should return the
 * number of rows that would be lost — an empty database is safe to wipe
 * even in production, which is what lets a brand-new deployment seed
 * itself on first boot.
 */
export async function assertWipeAllowed(countExistingRows, what = "wipe") {
  if (isLocalDatabase()) return;
  if (wipeConfirmed()) return;

  let existing;
  try {
    existing = await countExistingRows();
  } catch (err) {
    // Could not ask the database how much is at stake. That is not
    // permission — it is the absence of an answer.
    throw new Error(
      `${what} refused: cannot verify what is in the database at ${hostOf()}.\n` +
      `  ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\n` +
      `  Refusing rather than guessing. Set CONFIRM_WIPE=I_UNDERSTAND to override.`,
    );
  }
  if (existing === 0) return;

  throw new Error(
    `${what} refused: the database at ${hostOf()} is not local and holds ${existing} organization(s).\n` +
    `  This would destroy real studio data.\n` +
    `  If that is genuinely what you want, set CONFIRM_WIPE=I_UNDERSTAND and run it again.`,
  );
}

export function hostOf() {
  try { return new URL(databaseUrl()).hostname || "(no host)"; }
  catch { return "(unparseable DATABASE_URL)"; }
}
