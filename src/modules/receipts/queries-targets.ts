// Where a payment can be put: the client's open jobs.
//
// Split out of queries.ts to stay under the §10 300-line limit. Kept next
// to it — both answer "what does this client owe?", one in bills and one in
// jobs, and the payment sheet asks both in the same breath.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { loadProjectReceivables, openReceivables } from "@/modules/projects/receivable";
import type { RequestContext } from "@/kernel/auth/context";

/** One project a payment can be recorded against — an agreed quotation with
 *  money still to come. */
export interface OpenProjectForReceipt {
  id:              string;
  number:          string;
  name:            string;
  quotationNumber: string | null;
  agreedValue:     bigint;
  received:        bigint;
  due:             bigint;
  agreementDate:   Date;
}

/** Projects of one client that still owe money against their quotation.
 *  This is the primary target for a payment: under the quotation-first flow
 *  most money arrives long before any invoice exists. */
export async function listOpenProjectsForClient(
  ctx:      RequestContext,
  clientId: string,
): Promise<OpenProjectForReceipt[]> {
  requirePermission(ctx, "receipt.create");
  const db = scoped(ctx);

  const rows = openReceivables(await loadProjectReceivables(db, { clientId }));
  return rows
    .sort((a, b) => a.agreementDate.getTime() - b.agreementDate.getTime())
    .map((r) => ({
      id:              r.projectId,
      number:          r.projectNumber,
      name:            r.projectName,
      quotationNumber: r.quotationNumber,
      agreedValue:     r.agreedValue,
      received:        r.received,
      due:             r.due,
      agreementDate:   r.agreementDate,
    }));
}
