"use server";

// Leads server actions. Every mutation:
//   - checks permission via requirePermission (Rule 8)
//   - validates input with Zod (schema.ts)
//   - writes through db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - emits a domain event after commit (Rule 5)

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { collectEvents } from "@/kernel/events/bus";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import {
  createLeadSchema, updateLeadSchema, statusChangeSchema, } from "./schema";
import { dbError, emptyToNull, normaliseMobile, parseRupeesInput, zodError } from "./actions-part2-util";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.create");

  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const data = parsed.data;

  // Resolve number prefix from the branch (or fall back to "MDV")
  const db = scoped(ctx);
  try {
  let prefix = "MDV";
  if (data.branchId) {
    const branch = await db.branch.findUnique({
      where: { id: data.branchId },
      select: { invoicePrefix: true },
    });
    if (branch) prefix = branch.invoicePrefix;
  } else {
    const branch = await db.branch.findFirst({ select: { invoicePrefix: true } });
    if (branch) prefix = branch.invoicePrefix;
  }

  const yymm = yymmFromDate(new Date());
  const { publish, flush } = collectEvents();

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId: ctx.orgId,
      series: "ENQ",
      yymm,
      prefix,
    });

    const budgetPaise = parseRupeesInput(data.estimatedBudget);

    const lead = await tx.lead.create({
      data: {
        organizationId: ctx.orgId,
        number,
        name:        data.name,
        mobile:      normaliseMobile(data.mobile),
        email:       emptyToNull(data.email),
        source:      data.source,
        stage:       "NEW",
        ownerId:     data.ownerId ?? ctx.userId,
        budgetMin:   null,
        budgetMax:   budgetPaise,
        requirement: emptyToNull(data.requirement),
        siteAddress: {
          city:      data.city ?? null,
          pincode:   emptyToNull(data.pincode),
          altMobile: emptyToNull(data.altMobile),
          address:   emptyToNull(data.address),
          priority:  data.priority,
        },
      },
      select: { id: true, source: true, mobile: true },
    });

    publish({
      type: "lead.created",
      orgId: ctx.orgId,
      actorId: ctx.userId,
      occurredAt: new Date(),
      leadId: lead.id,
      source: lead.source,
      mobile: lead.mobile,
    });

    return lead;
  }, { orgId: ctx.orgId });

  await flush();
  revalidatePath("/leads");
  return { ok: true, data: { id: created.id } };
  } catch (e) { return dbError(e); }
}

export async function updateLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.update");

  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, ...rest } = parsed.data;

  const db = scoped(ctx);
  try {
  // Read existing siteAddress so we can merge partial updates
  const existing = await db.lead.findUnique({
    where: { id },
    select: { siteAddress: true },
  });
  const existingAddr = (existing?.siteAddress ?? {}) as Record<string, unknown>;

  const hasSiteFields = rest.city != null || rest.pincode != null ||
    rest.altMobile != null || rest.address != null || rest.priority != null;

  const mergedAddr = hasSiteFields
    ? {
        ...existingAddr,
        ...(rest.city      != null && { city:      rest.city }),
        ...(rest.pincode   != null && { pincode:   emptyToNull(rest.pincode) }),
        ...(rest.altMobile != null && { altMobile: emptyToNull(rest.altMobile) }),
        ...(rest.address   != null && { address:   emptyToNull(rest.address) }),
        ...(rest.priority  != null && { priority:  rest.priority }),
      }
    : undefined;

  const budgetPaise = rest.estimatedBudget != null
    ? parseRupeesInput(rest.estimatedBudget)
    : undefined;

  await db.lead.update({
    where: { id },
    data: {
      ...(rest.name        != null && { name:        rest.name }),
      ...(rest.mobile      != null && { mobile:      normaliseMobile(rest.mobile) }),
      ...(rest.email       != null && { email:       emptyToNull(rest.email) }),
      ...(rest.source      != null && { source:      rest.source }),
      ...(rest.ownerId     != null && { ownerId:     rest.ownerId }),
      ...(rest.requirement != null && { requirement: emptyToNull(rest.requirement) }),
      ...(budgetPaise      !== undefined && { budgetMin: null, budgetMax: budgetPaise }),
      ...(mergedAddr       != null && { siteAddress: mergedAddr }),
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
  } catch (e) { return dbError(e); }
}

export async function changeLeadStage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.update");

  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, to, lostReason } = parsed.data;

  const { publish, flush } = collectEvents();

  try {
  await withTransaction(async (tx: TxClient) => {
    const before = await tx.lead.findUniqueOrThrow({
      where: { id },
      select: { stage: true },
    });
    if (before.stage === to) return;

    await tx.lead.update({
      where: { id },
      data: {
        stage: to,
        ...(lostReason != null && { lostReason }),
      },
    });

    publish({
      type: "lead.statusChanged",
      orgId: ctx.orgId,
      actorId: ctx.userId,
      occurredAt: new Date(),
      leadId: id,
      from: before.stage,
      to,
      ...(lostReason != null && { lostReason }),
    });
  }, { orgId: ctx.orgId });

  await flush();
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
  } catch (e) { return dbError(e); }
}

// Keep old name as alias so any existing callers don't break
