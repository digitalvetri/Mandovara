/* global fetch */
// One-off scan of a rendered accounts view for banned accounting terms.
// Reads cookie from tests/e2e/.auth/owner.json, fetches a URL, strips HTML,
// and returns any banned term hit.

import fs from "node:fs";

const url = process.argv[2] ?? "http://localhost:3000/accounts";
const jar = JSON.parse(fs.readFileSync("tests/e2e/.auth/owner.json", "utf8"));
const cookie = jar.cookies.find((c) => c.name === "mv_sess")?.value;
if (!cookie) { console.error("No mv_sess cookie in owner.json"); process.exit(1); }

const html = await fetch(url, { headers: { cookie: `mv_sess=${cookie}` } }).then((r) => r.text());
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<[^>]+>/g, " ");

const banned = [
  "accounts receivable", "accounts payable", "receivables", "payables",
  "debtors", "creditors", "ageing", "ageing bucket", "aging", "aging bucket",
  "allocation", "unallocated", "on account", "reconciliation",
  "credit note", "credit memo", "debit note", "ledger",
  "overdue by", "days overdue",
];

const hits = [];
for (const term of banned) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\W)${esc}(\\W|$)`, "i");
  if (re.test(text)) hits.push(term);
}

if (hits.length === 0) {
  console.log(`CLEAN — no banned accounting terms in ${url}`);
} else {
  console.log(`BANNED TERMS FOUND in ${url}:`);
  hits.forEach((h) => console.log(`  · ${h}`));
  process.exit(1);
}
