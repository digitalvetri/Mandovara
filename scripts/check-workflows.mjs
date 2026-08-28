#!/usr/bin/env node
// Parse every GitHub Actions workflow and fail if one is malformed.
//
// Written after breaking deploy.yml on 2026-08-28. A multi-line script
// had been embedded in a `run: |` block with its lines at column zero,
// which silently terminates the YAML block scalar. GitHub could not
// parse the file, so the run appeared as ".github/workflows/" and failed
// instantly — before any step, with no useful message. The push looked
// fine locally because nothing validated the YAML.
//
//   pnpm check:workflows
//
// Catches the two mistakes that actually happen here: a file that does
// not parse at all, and a job whose steps went missing because a block
// scalar swallowed them.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const DIR = ".github/workflows";
let failed = false;

for (const file of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const path = join(DIR, file);
  let doc;
  try {
    doc = YAML.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ ${file} — does not parse: ${err.message}`);
    failed = true;
    continue;
  }

  if (!doc || typeof doc !== "object" || !doc.jobs) {
    console.error(`✗ ${file} — no jobs block. A run: | scalar may have swallowed it.`);
    failed = true;
    continue;
  }

  let steps = 0;
  for (const [name, job] of Object.entries(doc.jobs)) {
    if (!Array.isArray(job?.steps) || job.steps.length === 0) {
      console.error(`✗ ${file} — job "${name}" has no steps.`);
      failed = true;
      continue;
    }
    steps += job.steps.length;
  }
  if (!failed) console.log(`✓ ${file} — ${Object.keys(doc.jobs).length} job(s), ${steps} step(s)`);
}

process.exit(failed ? 1 : 0);
