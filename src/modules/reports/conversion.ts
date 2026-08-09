// Lead conversion by source report.
// Conversion rate = WON leads / total leads per source.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ConversionRow {
  source:         string;
  total:          number;
  won:            number;
  lost:           number;
  inProgress:     number;   // not yet WON or LOST
  conversionPct:  string;   // "33.33" or "" when total=0
}

export async function listConversionReport(
  ctx: RequestContext,
): Promise<ConversionRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db = scoped(ctx);

  const [total, won, lost] = await Promise.all([
    db.lead.groupBy({
      by:      ["source"],
      where:   { organizationId: ctx.orgId },
      _count:  { _all: true },
      orderBy: { source: "asc" },
    }),
    db.lead.groupBy({
      by:     ["source"],
      where:  { organizationId: ctx.orgId, stage: "WON" },
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by:     ["source"],
      where:  { organizationId: ctx.orgId, stage: "LOST" },
      _count: { _all: true },
    }),
  ]);

  const wonMap  = new Map(won.map((r)  => [r.source, r._count._all]));
  const lostMap = new Map(lost.map((r) => [r.source, r._count._all]));

  return total.map((r) => {
    const n   = r._count._all;
    const w   = wonMap.get(r.source)  ?? 0;
    const l   = lostMap.get(r.source) ?? 0;
    const pct = n > 0 ? ((w / n) * 100).toFixed(2) : "";
    return {
      source:        r.source,
      total:         n,
      won:           w,
      lost:          l,
      inProgress:    n - w - l,
      conversionPct: pct,
    };
  });
}
