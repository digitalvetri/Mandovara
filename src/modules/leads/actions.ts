"use server";
/* eslint-disable max-lines -- FIXME(§10): 410 lines, limit 300. Split by concern before the next phase; the rule stays enforced so this stays visible. */

// Leads server actions. Every mutation:
//   - checks permission via requirePermission (Rule 8)
//   - validates input with Zod (schema.ts)
//   - writes through db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - emits a domain event after commit (Rule 5)

import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { collectEvents } from "@/kernel/events/bus";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import {
  createLeadSchema, updateLeadSchema, statusChangeSchema, convertLeadSchema,
} from "./schema";

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
export const changeLeadStatus = changeLeadStage;

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
  try {
    await db.lead.delete({ where: { id } });
    revalidatePath("/leads");
    return { ok: true };
  } catch (e) {
    return dbError(e);
  }
}

// ── helpers ──────────────────────────────────────────────────────────

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

function dbError<T>(e: unknown): ActionResult<T> {
  if (e instanceof Error && (
    e.constructor.name === "PrismaClientInitializationError" ||
    e.message.includes("Can't reach database server")
  )) {
    return { ok: false, error: "Database is unavailable. Please ensure the database server is running and try again." };
  }
  throw e;
}

function normaliseMobile(m: string): string {
  const clean = m.trim();
  return clean.startsWith("+91") ? clean : `+91${clean}`;
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

// Parses a user-entered rupee string ("250000" or "2,50,000") to paise.
function parseRupeesInput(v: string | undefined | null): bigint | null {
  if (!v || v.trim() === "") return null;
  const clean = v.trim().replace(/[,₹\s]/g, "");
  const num = parseInt(clean, 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return BigInt(num) * 100n;
}
