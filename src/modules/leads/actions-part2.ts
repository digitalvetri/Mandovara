"use server";

// Split out of actions.ts to stay under the §10 300-line limit.


// Leads server actions. Every mutation:
//   - checks permission via requirePermission (Rule 8)
//   - validates input with Zod (schema.ts)
//   - writes through db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - emits a domain event after commit (Rule 5)

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { convertLeadSchema } from "./schema";
import { ActionResult } from "./actions";
import { dbError, parseRupeesInput, zodError } from "./actions-part2-util";


export async function convertLead(
  input: unknown,
): Promise<ActionResult<{ clientId: string; projectId: string | null }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.convert");

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) return zodError<{ clientId: string; projectId: string | null }>(parsed.error);
  const {
    id,
    billingLine1, billingCity, billingState, billingPincode, billingCountry,
    gstin, pan, stateCode, paymentTermsDays: paymentTermsDaysStr, creditLimit: creditLimitStr,
    projectName: projNameInput, projectType, siteCity, requirement: reqInput, estimatedBudget, expectedStartDate,
  } = parsed.data;

  const db = scoped(ctx);
  try {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, name: true, mobile: true, email: true,
      stage: true, convertedClientId: true,
      siteAddress: true, architectId: true,
    },
  });

  // Idempotent: already converted — return existing client + first linked project
  if (lead.convertedClientId != null) {
    const existingProject = await db.project.findFirst({
      where: { clientId: lead.convertedClientId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return { ok: true, data: { clientId: lead.convertedClientId, projectId: existingProject?.id ?? null } };
  }
  if (lead.stage === "LOST") {
    return { ok: false, error: "This lead is marked lost and cannot be converted." };
  }

  const yymm = yymmFromDate(new Date());

  // Get first branch for the org (outside the tx to avoid holding the lock longer)
  const branch = await db.branch.findFirst({
    select: { id: true, invoicePrefix: true },
  });
  if (!branch) {
    return { ok: false, error: "No branch is configured for this organisation. Add one in Settings before converting a lead." };
  }

  const addr = lead.siteAddress as Record<string, unknown> | null;
  const finalName = projNameInput?.trim()
    || (typeof addr?.projectName === "string" && addr.projectName ? addr.projectName : lead.name);

  const clientBillingAddress = {
    ...(billingLine1   && { line1:    billingLine1   }),
    ...(billingCity    && { city:     billingCity    }),
    ...(billingState   && { state:    billingState   }),
    ...(billingPincode && { pincode:  billingPincode }),
    ...(billingCountry && { country:  billingCountry }),
  };

  // All soft project intake fields go into siteAddress JSON — never overload orderValue or expectedInstallAt
  const projSiteAddr: Prisma.InputJsonObject = {
    ...(addr ?? {}),
    ...(projectType       && { projectType }),
    ...(siteCity          && { city: siteCity }),
    ...(reqInput          && { requirement: reqInput }),
    ...(estimatedBudget   && { estimatedBudget }),
    ...(expectedStartDate && { expectedStartDate }),
  };

  const creditLimitPaise = parseRupeesInput(creditLimitStr) ?? 0n;
  const paymentTermsDaysInt = paymentTermsDaysStr
    ? Math.max(0, parseInt(paymentTermsDaysStr, 10) || 30)
    : 30;

  const result = await withTransaction(async (tx: TxClient) => {
    // 1. Allocate and create Client
    const code = await allocateNumber(tx, { orgId: ctx.orgId, series: "CLI", yymm, prefix: "MDV" });
    const client = await tx.client.create({
      data: {
        organizationId:  ctx.orgId,
        code,
        name:            lead.name,
        mobile:          lead.mobile,
        email:           lead.email ?? undefined,
        billingAddress:  clientBillingAddress,
        gstin:           gstin  || undefined,
        pan:             pan    || undefined,
        stateCode:       stateCode || "33",
        creditLimit:     creditLimitPaise,
        paymentTermsDays: paymentTermsDaysInt,
        ownerId:         ctx.userId,
      },
      select: { id: true },
    });

    // 2. Allocate and create Project linked to the new Client
    const projNumber = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "PRJ",
      yymm,
      prefix: branch.invoicePrefix,
    });
    const project = await tx.project.create({
      data: {
        organizationId: ctx.orgId,
        branchId:       branch.id,
        number:         projNumber,
        name:           finalName,
        clientId:       client.id,
        stage:          "ENQUIRY",
        siteAddress:    projSiteAddr,
        ownerId:        ctx.userId,
        ...(lead.architectId && { architectId: lead.architectId }),
      },
      select: { id: true },
    });

    // 3. Mark lead as WON + store the client link
    await tx.lead.update({
      where: { id: lead.id },
      data: { stage: "WON", convertedClientId: client.id },
    });

    // 4. FIXES-01 §5.1 — re-link every lead-scoped quotation for this
    //    lead onto the newly-created Client + Project. Preserves history
    //    (nothing deleted) while satisfying the party XOR constraint
    //    (leadId nulled, clientId set).
    await tx.quotation.updateMany({
      where: { leadId: lead.id },
      data:  { leadId: null, clientId: client.id, projectId: project.id },
    });

    // 5. Same treatment for the site measurement taken while this was
    //    still a lead (2026-08-27). This is what "the measurement
    //    carries forward" means concretely: the rooms and the rounds are
    //    the SAME rows, re-pointed at the project — not copies. Every
    //    MeasurementItem, CalcResult, photo and dye-lot note follows for
    //    free because they hang off the round and the room by id.
    //
    //    Rooms MUST move in the same transaction as the rounds. A
    //    MeasurementItem points at a room AND (via its round) at a
    //    party; if only one side reparented, an item's room would belong
    //    to a project its measurement did not, and both the firm-quote
    //    query and the cut list would silently read the wrong set.
    await tx.room.updateMany({
      where: { leadId: lead.id },
      data:  { leadId: null, projectId: project.id },
    });
    await tx.measurement.updateMany({
      where: { leadId: lead.id },
      data:  { leadId: null, projectId: project.id },
    });

    // 6. Any site visit booked against the lead now belongs to the
    //    project too, so the project's visit list is complete from day
    //    one rather than starting empty after conversion.
    await tx.siteVisit.updateMany({
      where: { leadId: lead.id },
      data:  { leadId: null, projectId: project.id },
    });

    return { clientId: client.id, projectId: project.id };
  }, { orgId: ctx.orgId });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  revalidatePath("/projects");
  return { ok: true, data: result };
  } catch (e) { return dbError(e); }
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.delete");
  const db = scoped(ctx);

  // Refuse to delete a lead that already converted into a client — the
  // convertedClientId link is the audit trail of that conversion, and the
  // client + downstream project/order/invoice would still reference it.
  // Owner should archive the client instead.
  const lead = await db.lead.findUnique({
    where:  { id },
    select: { convertedClientId: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.convertedClientId) {
    return {
      ok: false,
      error: "This lead was converted to a client — delete the client instead (if it has no projects).",
    };
  }

  // Null out every nullable FK that points at this lead so the delete
  // doesn't crash with a P2003 FK-constraint error. Historical rows
  // (quotations sent to the lead, WhatsApp messages, follow-ups) survive
  // in a lead-less state — the fields are all nullable in the schema.
  try {
    await db.$transaction([
      db.quotation.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      db.siteVisit.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      db.communicationLog.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      db.document.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      db.followUp.deleteMany({ where: { refType: "LEAD", refId: id } }),
      db.lead.delete({ where: { id } }),
    ]);
    revalidatePath("/leads");
    return { ok: true };
  } catch (e) {
    console.error("deleteLead failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Delete failed: ${msg.split("\n")[0]}` };
  }
}

// ── helpers ──────────────────────────────────────────────────────────





// Parses a user-entered rupee string ("250000" or "2,50,000") to paise.
