// §14 Phase 8 gate — "unapproved template blocked; utility vs
// marketing cost logged correctly." Also proves §15 rule 10
// (idempotent WhatsApp writes) by re-sending with the same key.
//
// Run: pnpm tsx scripts/smoke-whatsapp-gate.ts

import { prisma } from "../src/kernel/db/client";
import { devContext } from "../src/lib/dev-context";
import {
  createTemplate, approveTemplate,
  sendWhatsAppMessage, COST_PAISE_BY_CATEGORY,
} from "../src/modules/whatsapp/actions";

const created = {
  templateIds: [] as string[],
  logIds:      [] as string[],
};

async function main() {
  await devContext();
  const uniq = Date.now();

  const draft = await createTemplate({
    name:     `smoke_draft_${uniq}`,
    language: "en", category: "UTILITY",
    body:     "Draft: {{1}}",
  });
  if (!draft.ok) throw new Error(`draft create: ${draft.error}`);
  created.templateIds.push(draft.data!.id);

  const utility = await createTemplate({
    name:     `smoke_utility_${uniq}`,
    language: "en", category: "UTILITY",
    body:     "Utility: invoice {{1}} issued.",
  });
  if (!utility.ok) throw new Error(`utility create: ${utility.error}`);
  created.templateIds.push(utility.data!.id);
  await approveTemplate({ id: utility.data!.id });

  const marketing = await createTemplate({
    name:     `smoke_marketing_${uniq}`,
    language: "en", category: "MARKETING",
    body:     "Marketing: {{1}} launched!",
  });
  if (!marketing.ok) throw new Error(`marketing create: ${marketing.error}`);
  created.templateIds.push(marketing.data!.id);
  await approveTemplate({ id: marketing.data!.id });
  console.log(`fixture · 3 templates seeded`);

  const blocked = await sendWhatsAppMessage({
    templateName: `smoke_draft_${uniq}`,
    language: "en",
    toMobile: "+919000000042",
    idempotencyKey: `smoke-${uniq}-1`,
  });
  if (blocked.ok) throw new Error("FAIL: DRAFT template was NOT blocked");
  console.log(`step 1 · DRAFT template blocked (${blocked.error})`);

  const u = await sendWhatsAppMessage({
    templateName: `smoke_utility_${uniq}`,
    language: "en",
    toMobile: "+919000000043",
    params: { "1": "INV/26-27/00001" },
    idempotencyKey: `smoke-${uniq}-utility`,
    entityType: "INVOICE",
    entityId: "smoke-inv-1",
  });
  if (!u.ok) throw new Error(`utility send: ${u.error}`);
  created.logIds.push(u.data!.messageLogId);
  console.log(`step 2 · utility sent · cost=${u.data!.costPaise} paise`);
  if (u.data!.costPaise !== COST_PAISE_BY_CATEGORY.UTILITY.toString()) {
    throw new Error(`FAIL: utility cost expected ${COST_PAISE_BY_CATEGORY.UTILITY}, got ${u.data!.costPaise}`);
  }
  const uLog = await prisma.messageLog.findUniqueOrThrow({
    where: { id: u.data!.messageLogId }, select: { body: true, costPaise: true },
  });
  if (!uLog.body.includes("INV/26-27/00001")) {
    throw new Error(`FAIL: body not substituted — got "${uLog.body}"`);
  }

  const m = await sendWhatsAppMessage({
    templateName: `smoke_marketing_${uniq}`,
    language: "en",
    toMobile: "+919000000044",
    params: { "1": "Winter Collection" },
    idempotencyKey: `smoke-${uniq}-marketing`,
  });
  if (!m.ok) throw new Error(`marketing send: ${m.error}`);
  created.logIds.push(m.data!.messageLogId);
  console.log(`step 3 · marketing sent · cost=${m.data!.costPaise} paise`);
  if (m.data!.costPaise !== COST_PAISE_BY_CATEGORY.MARKETING.toString()) {
    throw new Error(`FAIL: marketing cost expected ${COST_PAISE_BY_CATEGORY.MARKETING}, got ${m.data!.costPaise}`);
  }
  const ratio = Number(COST_PAISE_BY_CATEGORY.MARKETING) / Number(COST_PAISE_BY_CATEGORY.UTILITY);
  console.log(`         marketing/utility cost ratio: ${ratio.toFixed(2)}× (spec: 7.5×)`);

  const retry = await sendWhatsAppMessage({
    templateName: `smoke_utility_${uniq}`,
    language: "en",
    toMobile: "+919000000043",
    params: { "1": "INV/26-27/00001" },
    idempotencyKey: `smoke-${uniq}-utility`,
    entityType: "INVOICE",
    entityId: "smoke-inv-1",
  });
  if (!retry.ok) throw new Error(`idempotent retry: ${retry.error}`);
  console.log(`step 4 · retry with same key · deduped=${retry.data!.deduped}`);
  if (retry.data!.messageLogId !== u.data!.messageLogId) {
    throw new Error(`FAIL: retry returned new log id`);
  }
  if (!retry.data!.deduped) throw new Error(`FAIL: retry not marked deduped`);

  const count = await prisma.messageLog.count({
    where: { idempotencyKey: { startsWith: `smoke-${uniq}` } },
  });
  console.log(`step 5 · MessageLog count for smoke keys: ${count} (expected 2)`);
  if (count !== 2) throw new Error(`FAIL: expected 2 rows, got ${count}`);

  console.log("\nPASS — §14 Phase 8 gate: DRAFT blocked, utility=12p, marketing=87p, idempotency holds.");
}

async function cleanup() {
  try {
    for (const id of created.logIds) {
      try { await prisma.messageLog.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.templateIds) {
      try { await prisma.messageLog.deleteMany({ where: { templateId: id } }); } catch { /* ok */ }
      try { await prisma.messageTemplate.delete({ where: { id } }); } catch { /* ok */ }
    }
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
