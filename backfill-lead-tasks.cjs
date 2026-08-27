// One-time backfill: create FollowUp records for all leads that have an
// owner assigned but no open follow-up yet.
//
// Also removes the Task records previously created by mistake (they belong
// in FollowUp so they show in "My Tasks", not just the employee dashboard).
//
// Safe to re-run — skips leads that already have an open follow-up.
// Run with: node backfill-lead-tasks.cjs

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Terminal stages — no point following up on these
const SKIP_STAGES = new Set(["LOST", "CLOSED"]);

(async () => {
  // ── Step 1: remove the wrongly-created Task records for leads ────────────
  const deleted = await prisma.task.deleteMany({
    where: { refType: "LEAD" },
  });
  console.log(`Removed ${deleted.count} lead Task record(s) (wrong model — should be FollowUp)`);

  // ── Step 2: create FollowUp records for assigned leads ───────────────────
  const allLeads = await prisma.lead.findMany({
    select: { id: true, name: true, ownerId: true, stage: true, organizationId: true },
  });
  const leads = allLeads.filter((l) => l.ownerId != null);

  console.log(`Found ${leads.length} assigned lead(s)`);

  let created = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (SKIP_STAGES.has(lead.stage)) {
      console.log(`  skip (${lead.stage}): ${lead.name}`);
      skipped++;
      continue;
    }

    // Already has an open follow-up?
    const existing = await prisma.followUp.findFirst({
      where: {
        refType:     "LEAD",
        refId:       lead.id,
        completedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`  skip (follow-up exists): ${lead.name}`);
      skipped++;
      continue;
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 2);

    await prisma.followUp.create({
      data: {
        organizationId: lead.organizationId,
        ownerId:  lead.ownerId,
        dueAt,
        note:     `Follow up with ${lead.name}`,
        refType:  "LEAD",
        refId:    lead.id,
      },
    });

    console.log(`  created: Follow up with ${lead.name}`);
    created++;
  }

  console.log(`\nDone: ${created} follow-up(s) created, ${skipped} lead(s) skipped`);
})()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
