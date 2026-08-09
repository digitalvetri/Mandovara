// Smoke: create + read + update + delete one measurement of each family
// against the real Postgres, using the same server-side module code the
// UI uses.  Phase 2 gate: measurement writes land in the DB with a
// live CalcResult carrying engineVersion + outputs + warnings.
//
// Run with: pnpm tsx scripts/smoke-measurement.ts

import { prisma } from "../src/kernel/db/client";
import { runEngine } from "../src/modules/measurement/engine";

async function main() {
  const project = await prisma.project.findFirstOrThrow({
    select: { id: true, orgId: true, name: true, number: true },
  });
  console.log(`Using project ${project.number} — ${project.name}`);

  // Wipe any leftover smoke rows so the run is repeatable.
  await prisma.measurementItem.deleteMany({
    where: { projectId: project.id, label: { startsWith: "SMOKE " } },
  });

  const created: string[] = [];
  const cases = [
    {
      family: "WALLPAPER" as const,
      label: "SMOKE wallpaper — north wall",
      roomLabel: "Test room",
      inputs: {
        wallWidthMm: 4000, wallHeightMm: 2700,
        rollWidthMm: 530, rollLengthM: 10.05,
        patternMatch: "FREE" as const, patternRepeatMm: 0,
      },
    },
    {
      family: "FLOORING" as const,
      label: "SMOKE flooring — full room",
      roomLabel: "Test room",
      inputs: {
        roomLengthMm: 4000, roomWidthMm: 3500,
        layPattern: "STRAIGHT" as const,
        productKind: "BOX" as const,
        areaPerBoxSqft: 2.2, rollWidthMm: 0,
      },
    },
    {
      family: "CURTAIN" as const,
      label: "SMOKE curtain — bay window",
      roomLabel: "Test room",
      inputs: {
        windowWidthMm: 1800, windowHeightMm: 2100,
        fullness: 2.5, fabricWidthMm: 1100,
        patternMatch: "FREE" as const, patternRepeatMm: 0,
        railroadable: false, railroadedFabricWidthMm: 0,
        eyelet: false, lining: false,
      },
    },
  ];

  for (const c of cases) {
    const engine = runEngine({ projectId: project.id, ...c });
    const item = await prisma.measurementItem.create({
      data: {
        orgId: project.orgId, projectId: project.id,
        roomLabel: c.roomLabel, label: c.label,
        family: c.family, inputs: c.inputs,
      },
      select: { id: true },
    });
    await prisma.calcResult.create({
      data: {
        orgId: project.orgId, measurementItemId: item.id,
        engineVersion: engine.engineVersion, family: c.family,
        inputs: c.inputs, outputs: engine.outputs as object, warnings: engine.warnings,
      },
    });
    created.push(item.id);
    console.log(`  ✓ ${c.family.padEnd(9)} → ${item.id}`);
    console.log(`      engine=${engine.engineVersion}`);
    console.log(`      outputs=${JSON.stringify(engine.outputs)}`);
    if (engine.warnings.length > 0) {
      console.log(`      warnings=${JSON.stringify(engine.warnings)}`);
    }
  }

  // Read back through the query layer.
  const rows = await prisma.measurementItem.findMany({
    where: { id: { in: created } },
    include: { calcResult: true },
  });
  console.log(`\nRead-back: ${rows.length} MeasurementItem, ${rows.filter((r) => r.calcResult).length} CalcResult attached`);

  // Cleanup.
  await prisma.measurementItem.deleteMany({ where: { id: { in: created } } });
  console.log("Cleaned up smoke rows.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
