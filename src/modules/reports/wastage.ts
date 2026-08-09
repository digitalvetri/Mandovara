// Wastage by tailor / make-supervisor report.
// Actual fabric wasted vs issued, per assignee.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { Decimal } from "@prisma/client/runtime/library";

export interface WastageRow {
  employeeId:    string;
  employeeName:  string;
  jobCount:      number;
  issuedM:       string;   // Decimal string — total fabric issued
  wastedM:       string;   // Decimal string — total wastage recorded
  wastagePct:    string;   // "4.20" — empty when issuedM = 0
}

export async function listWastageReport(ctx: RequestContext): Promise<WastageRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const jobs = await db.makeJob.findMany({
    where:  { organizationId: ctx.orgId, assignedToId: { not: null } },
    select: {
      assignedToId: true,
      lines: {
        select: { fabricIssuedM: true, wastageM: true },
      },
    },
  });

  // Aggregate by assignedToId
  const byEmployee = new Map<string, { jobs: number; issued: Decimal; wasted: Decimal }>();
  for (const job of jobs) {
    if (!job.assignedToId) continue;
    const agg = byEmployee.get(job.assignedToId) ?? { jobs: 0, issued: new Decimal(0), wasted: new Decimal(0) };
    agg.jobs += 1;
    for (const line of job.lines) {
      if (line.fabricIssuedM) agg.issued = agg.issued.add(line.fabricIssuedM);
      if (line.wastageM)      agg.wasted = agg.wasted.add(line.wastageM);
    }
    byEmployee.set(job.assignedToId, agg);
  }

  if (byEmployee.size === 0) return [];

  // Resolve employee names
  const employeeIds = [...byEmployee.keys()];
  const employees   = await db.employee.findMany({
    where:  { id: { in: employeeIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(employees.map((e) => [e.id, e.name]));

  return [...byEmployee.entries()]
    .sort((a, b) => (b[1].wasted.comparedTo(a[1].wasted)))
    .map(([eid, agg]) => {
      const pct = agg.issued.gt(0)
        ? agg.wasted.div(agg.issued).mul(100).toDecimalPlaces(2).toString()
        : "";
      return {
        employeeId:   eid,
        employeeName: nameMap.get(eid) ?? eid,
        jobCount:     agg.jobs,
        issuedM:      agg.issued.toString(),
        wastedM:      agg.wasted.toString(),
        wastagePct:   pct,
      };
    });
}
