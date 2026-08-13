// @ts-nocheck
"use server";

// Leads server actions. Every mutation:
//   - checks permission via requirePermission (Rule 8)
//   - validates input with Zod (schema.ts)
//   - writes through db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - emits a domain event after commit (Rule 5)

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
  type BudgetRange,
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

    const [budgetMin, budgetMax] = parseBudgetRange(data.budgetRange as BudgetRange | undefined);

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
        budgetMin,
        budgetMax,
        requirement: emptyToNull(data.requirement),
        siteAddress: {
          city:        data.city ?? null,
          pincode:     emptyToNull(data.pincode),
          altMobile:   emptyToNull(data.altMobile),
          budgetRange: emptyToNull(data.budgetRange),
          priority:    data.priority,
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
  });

  await flush();
  revalidatePath("/leads");
  return { ok: true, data: { id: created.id } };
}

export async function updateLead(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.update");

  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, ...rest } = parsed.data;

  const db = scoped(ctx);

  // Read existing siteAddress so we can merge partial updates
  const existing = await db.lead.findUnique({
    where: { id },
    select: { siteAddress: true },
  });
  const existingAddr = (existing?.siteAddress ?? {}) as Record<string, unknown>;

  const hasSiteFields = rest.city != null || rest.pincode != null ||
    rest.altMobile != null || rest.budgetRange != null || rest.priority != null;

  const mergedAddr = hasSiteFields
    ? {
        ...existingAddr,
        ...(rest.city       != null && { city:       rest.city }),
        ...(rest.pincode    != null && { pincode:    emptyToNull(rest.pincode) }),
        ...(rest.altMobile  != null && { altMobile:  emptyToNull(rest.altMobile) }),
        ...(rest.budgetRange!= null && { budgetRange: emptyToNull(rest.budgetRange) }),
        ...(rest.priority   != null && { priority:   rest.priority }),
      }
    : undefined;

  const [budgetMin, budgetMax] = rest.budgetRange != null
    ? parseBudgetRange(rest.budgetRange as BudgetRange)
    : [undefined, undefined];

  await db.lead.update({
    where: { id },
    data: {
      ...(rest.name        != null && { name:        rest.name }),
      ...(rest.mobile      != null && { mobile:      normaliseMobile(rest.mobile) }),
      ...(rest.email       != null && { email:       emptyToNull(rest.email) }),
      ...(rest.source      != null && { source:      rest.source }),
      ...(rest.ownerId     != null && { ownerId:     rest.ownerId }),
      ...(rest.requirement != null && { requirement: emptyToNull(rest.requirement) }),
      ...(budgetMin        != null && { budgetMin }),
      ...(budgetMax        != null && { budgetMax }),
      ...(mergedAddr       != null && { siteAddress: mergedAddr }),
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
}

export async function changeLeadStage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.update");

  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, to, lostReason } = parsed.data;

  const { publish, flush } = collectEvents();

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
      type: "lead.stageChanged",
      orgId: ctx.orgId,
      actorId: ctx.userId,
      occurredAt: new Date(),
      leadId: id,
      from: before.stage,
      to,
      ...(lostReason != null && { lostReason }),
    });
  });

  await flush();
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
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
  const { id } = parsed.data;

  const db = scoped(ctx);
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
  const branch = await db.branch.findFirstOrThrow({
    select: { id: true, invoicePrefix: true },
  });

  const addr = lead.siteAddress as Record<string, unknown> | null;
  const projectName = (typeof addr?.projectName === "string" && addr.projectName)
    ? addr.projectName
    : lead.name;

  const result = await withTransaction(async (tx: TxClient) => {
    // 1. Allocate and create Client
    const code = await allocateNumber(tx, { orgId: ctx.orgId, series: "CLI", yymm, prefix: "MDV" });
    const client = await tx.client.create({
      data: {
        organizationId: ctx.orgId,
        code,
        name:           lead.name,
        mobile:         lead.mobile,
        email:          lead.email ?? undefined,
        billingAddress: {},
        ownerId:        ctx.userId,
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
        name:           projectName,
        clientId:       client.id,
        stage:          "ENQUIRY",
        siteAddress:    addr ?? {},
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

    return { clientId: client.id, projectId: project.id };
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  revalidatePath("/projects");
  return { ok: true, data: result };
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

function normaliseMobile(m: string): string {
  const clean = m.trim();
  return clean.startsWith("+91") ? clean : `+91${clean}`;
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

// Maps a predefined budget range slug to [budgetMin, budgetMax] in paise.
// 1 lakh = 1,00,000 rupees = 1,00,00,000 paise (10_000_000n).
const L = 10_000_000n; // 1 lakh in paise
const CR = 1_000_000_000n; // 1 crore in paise
function parseBudgetRange(range: BudgetRange | string | undefined | null): [bigint | null, bigint | null] {
  switch (range) {
    case "under-5L":  return [null,    5n * L];
    case "5L-10L":    return [5n * L,  10n * L];
    case "10L-25L":   return [10n * L, 25n * L];
    case "25L-50L":   return [25n * L, 50n * L];
    case "50L-1Cr":   return [50n * L, CR];
    case "above-1Cr": return [CR,      null];
    default:          return [null,    null];
  }
}
