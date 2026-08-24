// Project-scoped quotations + latest-order lookup for the QuotationPanel
// on /projects/[id]. Unlike getProjectPayments this is NOT permission-gated —
// quotations are visible to Sales / Designer / Owner, not just money roles.

import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";

export interface ProjectQuotationRow {
  id:            string;
  number:        string;
  revision:      number;
  status:        string;
  date:          Date;
  validUntil:    Date;
  total:         bigint;
  sentAt:        Date | null;
}

export interface ProjectQuotationsPanelData {
  quotations:      ProjectQuotationRow[];
  latestOrder:     { id: string; number: string } | null;
}

export async function getProjectQuotationsAndOrder(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectQuotationsPanelData> {
  const db = scoped(ctx);

  const [quotations, order] = await Promise.all([
    db.quotation.findMany({
      where:   { projectId },
      orderBy: [{ date: "desc" }, { revision: "desc" }],
      select:  {
        id: true, number: true, revision: true, status: true,
        date: true, validUntil: true, total: true, sentAt: true,
      },
    }),
    db.order.findFirst({
      where:   { projectId, status: { not: "CANCELLED" } },
      orderBy: { date: "desc" },
      select:  { id: true, number: true },
    }),
  ]);

  return {
    quotations,
    latestOrder: order,
  };
}
