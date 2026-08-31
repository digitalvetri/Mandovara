// §3.2 guard — every withTransaction() must pass { orgId }.
//
// The transaction client Prisma hands back bypasses the scoped(ctx)
// extension chain, so `app.current_org_id` is only set when withTransaction
// is given an orgId. Miss it and every raw statement inside runs with no
// tenant: reads return nothing, and writes hit the deny-by-default policy.
//
// That is not a hypothetical. Nine call sites had shipped without it, and
// the visible symptom was document numbering dying in production as the
// restricted role:
//
//   Raw query failed. Code: `42501`.
//   ERROR: new row violates row-level security policy for table "NumberSequence"
//
// It breaks nothing at compile time (orgId is optional by design, for the
// genuinely org-agnostic cases), it passes every test that runs as the
// owner — Postgres exempts superusers from row security — and it only
// surfaces in production, where the app connects as mandovara_app. So a
// type can't catch it and a normal test won't either. This scan can.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

/** Call sites of withTransaction( that do not pass an orgId in the options. */
function callsMissingOrgId(src: string): number[] {
  const lines = src.split("\n");
  const missing: number[] = [];
  let i = 0;

  while ((i = src.indexOf("withTransaction(", i)) !== -1) {
    const line = src.slice(0, i).split("\n").length;
    const text = (lines[line - 1] ?? "").trim();

    // Doc comments mention the call by name; they are not call sites.
    if (text.startsWith("//") || text.startsWith("*")) { i += "withTransaction(".length; continue; }

    // Walk to the matching close paren. Template literals hold raw SQL with
    // unbalanced parens, so skip their contents.
    let depth = 0, j = i + "withTransaction".length, inTemplate = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "`" && src[j - 1] !== "\\") inTemplate = !inTemplate;
      if (inTemplate) continue;
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) break; }
    }

    // The options object is the trailing `, { ... })` of the call.
    const call = src.slice(i, j + 1);
    const opts = call.match(/,\s*\{[^{}]*\}\s*,?\s*\)$/s);
    if (!opts || !/orgId/.test(opts[0])) missing.push(line);
    i = j + 1;
  }
  return missing;
}

describe("withTransaction tenant scoping", () => {
  it("every call site passes { orgId }", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      // The helper itself is where orgId is consumed, not passed.
      if (file.endsWith(join("kernel", "db", "transaction.ts"))) continue;
      const src = readFileSync(file, "utf8");
      if (!src.includes("withTransaction(")) continue;
      for (const line of callsMissingOrgId(src)) {
        offenders.push(`${file.slice(SRC.length + 1)}:${line}`);
      }
    }

    expect(
      offenders,
      `withTransaction() without { orgId } — these run with no app.current_org_id, ` +
      `so raw SQL inside them reads nothing and writes fail the RLS policy as ` +
      `mandovara_app:\n  ${offenders.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("detects a call that omits orgId", () => {
    expect(callsMissingOrgId("await withTransaction(async (tx) => { x(); });")).toEqual([1]);
  });

  it("accepts a call that passes orgId", () => {
    expect(
      callsMissingOrgId("await withTransaction(async (tx) => { x(); }, { orgId: ctx.orgId });"),
    ).toEqual([]);
  });

  it("ignores the name appearing in a comment", () => {
    expect(callsMissingOrgId("// use withTransaction(fn) here\n")).toEqual([]);
  });

  it("is not fooled by raw SQL in a template literal", () => {
    expect(
      callsMissingOrgId(
        "await withTransaction((tx) => tx.$queryRaw`SELECT foo(1) FROM t`, { orgId: o });",
      ),
    ).toEqual([]);
  });
});
