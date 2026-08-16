// Verifies quotation.accepted → milestone tick + stage advance QUOTATION → ORDERED.
// Creates a throwaway quotation on the selvi project, fires the event,
// reads back stage + milestone, then cleans everything up.
//
// Run: pnpm tsx scripts/verify-quotation-accepted.mjs

import { bus } from "../src/kernel/events/bus.ts";
import "../src/kernel/events/register.ts";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const PROJECT_ID = "cmsvm243r0003f8n4bj5kn09i"; // selvi

async function main() {
  const project = await prisma.project.findUniqueOrThrow({
    where:  { id: PROJECT_ID },
    select: { organizationId: true, ownerId: true, branchId: true, clientId: true, stage: true },
  });
  console.log("BEFORE stage:", project.stage);

  // Move stage to QUOTATION so we can meaningfully test the advance.
  await prisma.project.update({ where: { id: PROJECT_ID }, data: { stage: "QUOTATION" } });

  const quote = await prisma.quotation.create({
    data: {
      organizationId: project.organizationId,
      branchId:       project.branchId,
      number:         `TEST-Q-${randomUUID().slice(0, 8)}`,
      revision:       0,
      projectId:      PROJECT_ID,
      clientId:       project.clientId,
      date:           new Date(),
      validUntil:     new Date(Date.now() + 30 * 86400_000),
      status:         "ACCEPTED",
      taxableAmount:  0n,
      cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n, total: 0n,
      ownerId:        project.ownerId,
    },
    select: { id: true },
  });

  await bus.publish({
    type:        "quotation.accepted",
    orgId:       project.organizationId,
    actorId:     project.ownerId,
    occurredAt:  new Date(),
    quotationId: quote.id,
    clientId:    project.clientId,
  });

  const [after, mile] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: PROJECT_ID }, select: { stage: true } }),
    prisma.milestone.findFirst({
      where:  { projectId: PROJECT_ID, sourceEvent: "quotation.accepted" },
      select: { name: true, status: true, autoCompleted: true },
    }),
  ]);
  console.log("AFTER  stage:", after.stage, " (expected: ORDERED)");
  console.log("AFTER  milestone:", mile);

  // Clean up — remove the throwaway quotation, revert stage, reset milestone.
  await prisma.quotation.delete({ where: { id: quote.id } });
  await prisma.project.update({ where: { id: PROJECT_ID }, data: { stage: "SITE_VISIT" } });
  await prisma.milestone.updateMany({
    where: { projectId: PROJECT_ID, sourceEvent: "quotation.accepted" },
    data:  { status: "PENDING", autoCompleted: false, actualDate: null, completedAt: null },
  });
  console.log("Cleanup done — stage back to SITE_VISIT, milestone PENDING.");
}

main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
