// Verifies the measurement.approved → stage-advance wire.
// 1. Reads project stage BEFORE.
// 2. Fires bus.publish("measurement.approved") for the given projectId.
// 3. Reads project stage AFTER.
// 4. Also confirms the MEASUREMENT milestone row (if any) auto-completed.
//
// Run: pnpm tsx scripts/verify-measurement-approved.mjs

import { bus } from "../src/kernel/events/bus.ts";
import "../src/kernel/events/register.ts";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROJECT_ID = "cmsvm243r0003f8n4bj5kn09i"; // selvi
const MEASUREMENT_ID = "cmsvmcfqi0014f8n45syccejx"; // MEA-2608-0002 (already APPROVED)

async function readState() {
  const [p, mile] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: PROJECT_ID },
      select: { stage: true },
    }),
    prisma.milestone.findFirst({
      where: { projectId: PROJECT_ID, sourceEvent: "measurement.approved" },
      select: { name: true, status: true, autoCompleted: true },
    }),
  ]);
  return { stage: p.stage, milestone: mile };
}

async function main() {
  const before = await readState();
  console.log("BEFORE:", before);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: PROJECT_ID },
    select: { organizationId: true, ownerId: true },
  });

  await bus.publish({
    type:       "measurement.approved",
    orgId:      project.organizationId,
    actorId:    project.ownerId,
    occurredAt: new Date(),
    measurementId: MEASUREMENT_ID,
    projectId:  PROJECT_ID,
  });

  const after = await readState();
  console.log("AFTER: ", after);
}

main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
