// Every internal link must point at a route that exists.
//
// Added 2026-09-11 after the owner reported "when I edit the quotation I get
// a 404, and at many places". Five links pointed at routes that had never
// been built — /quotations/[id]/edit and /leads/[id]/edit among them. None of
// it was caught by typecheck, because `as Route` casts the string straight
// past Next's typed-routes check, and none by the E2E suite, which never
// clicked those particular menu items.
//
// So the check is mechanical instead: read the real route tree off the
// filesystem, read every link target out of the source, and require that each
// one resolves. It costs milliseconds and it cannot rot.
//
// Two classes, both failures, for different reasons:
//   · navigation (href / router.push / redirect) — a broken one is a 404 in
//     the user's face.
//   · revalidatePath — a broken one is silent: the page it meant to refresh
//     keeps serving stale data after a write, and nothing ever says so.
//
// Only statically-readable targets are checked. `href={hit.href}` is built at
// runtime and is invisible here — that is the limit of this test, not a hole
// worth closing with guesswork.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const APP = join(ROOT, "src", "app");
const SRC = join(ROOT, "src");

/** Stands in for a `${...}` template hole. Chosen so it cannot occur in a real
 *  path and needs no regex escaping. */
const HOLE = "<hole>";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** The real route tree: every page.tsx / route.ts under src/app. */
function realRoutes(): string[] {
  return walk(APP)
    .filter((f) => /[/\\](page|route)\.tsx?$/.test(f))
    .map((f) => {
      const r = "/" + relative(APP, f).replace(/\\/g, "/").replace(/\/(page|route)\.tsx?$/, "");
      // (app), (auth) etc. are organisational only — they never appear in a URL.
      const stripped = r.replace(/\/\([^/]+\)/g, "");
      return stripped === "" ? "/" : stripped;
    });
}

function routeMatcher(route: string): RegExp {
  const body = route
    .split("/")
    .map((seg) => {
      if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "(?:[^/]+)?"; // [[...slug]]
      if (/^\[\.\.\..+\]$/.test(seg)) return ".+";             // [...slug]
      if (/^\[.+\]$/.test(seg)) return "[^/]+";                // [id]
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${body}/?$`);
}

interface Hit { target: string; file: string; line: number }

/**
 * Read the string literal starting at `i` (which must be a quote), returning
 * its text with every `${...}` hole replaced by HOLE.
 *
 * Brace-aware rather than regex, because a template hole can itself contain
 * quotes and nested templates — `` `/samples${s === "ALL" ? "" : `?x=${s}`}` ``
 * is one string, and a regex that stops at the first inner quote reads it as a
 * broken link that isn't.
 */
function readStringLiteral(src: string, i: number): { value: string; end: number } | null {
  const quote = src[i];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let out = "";
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") { out += src[j + 1] ?? ""; j += 2; continue; }
    if (c === quote) return { value: out, end: j };
    if (quote === "`" && c === "$" && src[j + 1] === "{") {
      // Skip the hole, counting braces and respecting nested strings.
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === '"' || d === "'" || d === "`") {
          const inner = readStringLiteral(src, j);
          if (!inner) return null;
          j = inner.end + 1;
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        j++;
      }
      out += HOLE;
      continue;
    }
    out += c;
    j++;
  }
  return null;
}

const NAV_PREFIXES = [
  /\bhref=\s*\{?\s*$/,
  /\bhref:\s*$/,
  /\brouter\.(?:push|replace|prefetch)\(\s*$/,
  /(?<![A-Za-z0-9_$.])redirect\(\s*$/,
  /(?<![A-Za-z0-9_$.])permanentRedirect\(\s*$/,
];
const REVALIDATE_PREFIX = /\brevalidatePath\(\s*$/;

function collect(): { nav: Hit[]; revalidate: Hit[] } {
  const nav: Hit[] = [];
  const revalidate: Hit[] = [];

  for (const file of walk(SRC).filter((f) => /\.tsx?$/.test(f))) {
    const src = readFileSync(file, "utf8");
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c !== '"' && c !== "'" && c !== "`") continue;
      // Look back a little for what introduced this string.
      const before = src.slice(Math.max(0, i - 40), i);
      const isNav = NAV_PREFIXES.some((re) => re.test(before));
      const isRevalidate = REVALIDATE_PREFIX.test(before);
      if (!isNav && !isRevalidate) continue;

      const lit = readStringLiteral(src, i);
      if (!lit) continue;
      i = lit.end;

      const raw = lit.value;
      if (!raw.startsWith("/")) continue; // external URL, anchor, or relative
      const target = raw.split("?")[0]!.split("#")[0]!;
      const line = src.slice(0, i).split("\n").length;
      const hit: Hit = { target, file: relative(ROOT, file), line };
      (isNav ? nav : revalidate).push(hit);
    }
  }
  return { nav, revalidate };
}

/**
 * What a target containing holes can actually resolve to at runtime.
 *
 * A hole is opaque, and the two things it plausibly expands to lead to
 * different URLs: an id (`/leads/${id}` → /leads/abc) or nothing at all
 * (`/api/x/export${qs ? `?${qs}` : ""}` → /api/x/export).
 *
 * Only a TRAILING hole may expand to nothing — that is the query-string shape.
 * A hole with path after it is an id and is never legitimately empty; letting
 * it vanish would collapse /quotations/${id}/edit into /quotations/edit, which
 * matches /quotations/[id] and would hide exactly the 404 this test exists to
 * catch.
 */
function candidates(target: string): string[] {
  if (!target.includes(HOLE)) return [target];

  const tidy = (s: string) => s.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
  const out = [tidy(target.split(HOLE).join("X"))];

  if (target.endsWith(HOLE)) {
    const withoutTrailing = target.slice(0, -HOLE.length);
    out.push(tidy(withoutTrailing.split(HOLE).join("X")) || "/");
  }
  return out;
}

function unresolved(hits: Hit[], matchers: RegExp[]): string[] {
  return hits
    .filter((h) => !candidates(h.target).some((c) => matchers.some((re) => re.test(c))))
    .map((h) => `${h.target.split(HOLE).join("${…}")}  ←  ${h.file}:${h.line}`)
    .sort();
}

describe("internal links resolve to real routes", () => {
  const routes = realRoutes();
  const matchers = routes.map(routeMatcher);
  const { nav, revalidate } = collect();

  it("finds the route tree and the links in it", () => {
    // Guards the parser itself: if a refactor breaks extraction these drop to
    // zero and every assertion below passes vacuously.
    expect(routes.length).toBeGreaterThan(50);
    expect(nav.length).toBeGreaterThan(100);
    expect(revalidate.length).toBeGreaterThan(50);
  });

  it("has no navigation pointing at a route that does not exist", () => {
    expect(unresolved(nav, matchers)).toEqual([]);
  });

  it("has no revalidatePath pointing at a route that does not exist", () => {
    // A dead one is not a crash — it is a page that silently keeps serving
    // stale data after a write.
    expect(unresolved(revalidate, matchers)).toEqual([]);
  });
});
