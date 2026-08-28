#!/usr/bin/env node
// Print the tail of a Coolify deployment's build log.
//
// Exists as a file rather than inline in deploy.yml because embedding a
// multi-line script inside a YAML block scalar is how that workflow got
// broken on 2026-08-28: any line at column zero terminates the block,
// and GitHub then fails the whole workflow before running a step. A file
// has no such trap, and can be run by hand.
//
//   node scripts/print-coolify-log.mjs <deployment-uuid>
//
// Needs COOLIFY_URL and COOLIFY_TOKEN in the environment. Never exits
// non-zero: this runs on a path that is already failing, and its own
// failure must not replace the real error with a confusing one.

const { COOLIFY_URL, COOLIFY_TOKEN } = process.env;
const uuid = process.argv[2];

if (!COOLIFY_URL || !COOLIFY_TOKEN || !uuid) {
  console.log("(cannot fetch the deployment log — COOLIFY_URL, COOLIFY_TOKEN or uuid missing)");
  process.exit(0);
}

const TAIL_LINES = 60;

try {
  // globalThis.fetch, not a bare `fetch`: another script in this
  // directory declares its own, and a global declaration for one
  // makes the other a redeclaration.
  const res = await globalThis.fetch(`${COOLIFY_URL}/api/v1/deployments/${uuid}`, {
    headers: { Authorization: `Bearer ${COOLIFY_TOKEN}` },
  });
  if (!res.ok) {
    console.log(`(Coolify returned HTTP ${res.status} for the deployment record)`);
    process.exit(0);
  }

  const record = await res.json();
  const raw = record.logs;

  if (!raw) {
    console.log("(no logs on the deployment record)");
    console.log(`status: ${record.status ?? "unknown"}`);
    process.exit(0);
  }

  // Coolify stores logs as a JSON array of { output, type, timestamp }.
  // Older versions store a plain string — handle both rather than
  // printing "[object Object]" at the one moment someone needs to read it.
  let lines;
  try {
    const entries = typeof raw === "string" ? JSON.parse(raw) : raw;
    lines = Array.isArray(entries)
      ? entries.map((e) => String(e?.output ?? "").trimEnd())
      : String(raw).split("\n");
  } catch {
    lines = String(raw).split("\n");
  }

  const kept = lines.filter((l) => l.length > 0).slice(-TAIL_LINES);
  if (kept.length === 0) console.log("(the log was empty)");
  else kept.forEach((l) => console.log(l));
} catch (err) {
  console.log(`(could not fetch the deployment log: ${err?.message ?? err})`);
}
