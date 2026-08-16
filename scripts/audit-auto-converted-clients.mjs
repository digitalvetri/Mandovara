// scripts/audit-auto-converted-clients.mjs
//
// READ-ONLY audit. Reports every Client whose row was created by the
// convertLead() action (identified via Lead.convertedClientId). Groups
// them into "likely silent" (a lead who was flipped to Client via the
// Quick Quote button, with no real business follow-through) vs
// "legitimate" (a lead who was properly converted and has orders /
// invoices attached).
//
// Nothing is written or deleted. Output is:
//   - human summary to stdout
//   - JSON to /tmp/audit-report.json for follow-up scripting
//
// Bake into the Docker image so it runs against prod without SSH.
//   Local dev:  pnpm tsx scripts/audit-auto-converted-clients.mjs
//   Production: docker exec <app-container> node /app/scripts/audit-auto-converted-clients.mjs

import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const prisma = new PrismaClient();

const OUT_PATH = existsSync("/tmp")
  ? "/tmp/audit-report.json"
  : "./audit-report.json";

async function main() {
  const leadsWithConversion = await prisma.lead.findMany({
    where:  { convertedClientId: { not: null } },
    select: {
      id: true,
      name: true,
      mobile: true,
      stage: true,
      convertedClientId: true,
      createdAt: true,
    },
  });

  if (leadsWithConversion.length === 0) {
    console.log("No auto-converted clients found. Nothing to clean up.");
    return;
  }

  const clientIds = leadsWithConversion.map((l) => l.convertedClientId).filter((x) => x !== null);
  const [clients, quoteCounts, orderCounts, invoiceCounts] = await Promise.all([
    prisma.client.findMany({
      where:  { id: { in: clientIds } },
      select: { id: true, name: true, code: true, createdAt: true },
    }),
    prisma.quotation.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _count: { _all: true } }),
    prisma.order.groupBy({     by: ["clientId"], where: { clientId: { in: clientIds } }, _count: { _all: true } }),
    prisma.invoice.groupBy({   by: ["clientId"], where: { clientId: { in: clientIds } }, _count: { _all: true } }),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const quoteBy    = new Map(quoteCounts.map((r) => [r.clientId, r._count._all]));
  const orderBy    = new Map(orderCounts.map((r) => [r.clientId, r._count._all]));
  const invoiceBy  = new Map(invoiceCounts.map((r) => [r.clientId, r._count._all]));

  const rows = leadsWithConversion.map((l) => {
    const cid = l.convertedClientId;
    const client = cid ? clientById.get(cid) ?? null : null;
    const quotes   = cid ? quoteBy.get(cid)   ?? 0 : 0;
    const orders   = cid ? orderBy.get(cid)   ?? 0 : 0;
    const invoices = cid ? invoiceBy.get(cid) ?? 0 : 0;
    // "Silent" = client only exists to satisfy the FK on quotation. No
    // orders, no invoices, at most one quotation (the one that triggered
    // Quick Quote's silent conversion).
    const category = orders > 0 || invoices > 0
      ? "LEGITIMATE"
      : quotes > 1
        ? "REVIEW"
        : "LIKELY_SILENT";
    return {
      lead:     { id: l.id, name: l.name, mobile: l.mobile, stage: l.stage },
      client:   client ? { id: client.id, name: client.name, code: client.code, createdAt: client.createdAt } : null,
      counts:   { quotations: quotes, orders, invoices },
      category,
    };
  });

  const silent      = rows.filter((r) => r.category === "LIKELY_SILENT");
  const review      = rows.filter((r) => r.category === "REVIEW");
  const legitimate  = rows.filter((r) => r.category === "LEGITIMATE");

  console.log("\n──────────────────────────────────────────────────────────");
  console.log("  AUDIT — Auto-converted Clients (Lead.convertedClientId)");
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  Total lead-conversions : ${rows.length}`);
  console.log(`   ├─ LEGITIMATE         : ${legitimate.length}  (has orders/invoices — keep)`);
  console.log(`   ├─ REVIEW             : ${review.length}  (>1 quotation, no orders — check with Rohit)`);
  console.log(`   └─ LIKELY SILENT      : ${silent.length}  (candidates for reversal)`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (silent.length > 0) {
    console.log("LIKELY SILENT (first 20):");
    for (const r of silent.slice(0, 20)) {
      console.log(`  ${(r.lead.name ?? "—").padEnd(28)} → client ${r.client?.code ?? "—"}  q=${r.counts.quotations}`);
    }
    if (silent.length > 20) console.log(`  ... and ${silent.length - 20} more (see JSON report)`);
  }

  if (review.length > 0) {
    console.log("\nREVIEW (need Rohit's call):");
    for (const r of review) {
      console.log(`  ${(r.lead.name ?? "—").padEnd(28)} q=${r.counts.quotations}  o=${r.counts.orders}  i=${r.counts.invoices}`);
    }
  }

  await writeFile(OUT_PATH, JSON.stringify(rows, null, 2), "utf8");
  console.log(`\nFull report written to ${OUT_PATH}`);
  console.log("\nNext step: review LIKELY_SILENT with Rohit, then run the cleanup script\n(TBD next session — will backfill Quotation.leadId, null-out Quotation.clientId,\nand soft-delete the orphan Clients).\n");
}

main().catch((err) => { console.error("FAIL:", err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
