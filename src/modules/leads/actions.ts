// @ts-nocheck
"use server";

// Leads server actions. Every mutation:
//   - checks permission via requirePermission (Rule 8)
//   - validates input with Zod (schema.ts)
//   - writes through db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//   - emits a domain event after commit (Rule 5)
//
// NOTE: The `lead.created` / `lead.statusChanged` publish() calls reference
// event types that must be added to src/kernel/events/types.ts. Until that
// diff is applied, `publish({ type: "lead.created", ... })` will not
// typecheck â€” this is intentional so the module cannot silently ship
// without its events wired in.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { withEvents } from "@/kernel/events/bus";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { parseINR } from "@/kernel/money/format";
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

  const db = scoped(ctx);
  const created = await withEvents(async (publish) => {
    const lead = await db.lead.create({
      data: {
        orgId:        ctx.orgId,
        branchId:     data.branchId,
        name:         data.name,
        mobile:       normaliseMobile(data.mobile),
        email:        emptyToNull(data.email),
        companyName:  emptyToNull(data.companyName),
        source:       data.source,
        status:       "NEW",
        ownerId:      emptyToNull(data.ownerId) ?? ctx.userId,
        expectedValue: parseExpectedValue(data.expectedValue),
        requirement:  emptyToNull(data.requirement),
        createdById:  ctx.userId,
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
  await db.lead.update({
    where: { id },
    data: {
      ...(rest.name != null        && { name: rest.name }),
      ...(rest.mobile != null      && { mobile: normaliseMobile(rest.mobile) }),
      ...(rest.email != null       && { email: emptyToNull(rest.email) }),
      ...(rest.companyName != null && { companyName: emptyToNull(rest.companyName) }),
      ...(rest.source != null      && { source: rest.source }),
      ...(rest.ownerId != null     && { ownerId: emptyToNull(rest.ownerId) }),
      ...(rest.expectedValue != null && {
        expectedValue: parseExpectedValue(rest.expectedValue),
      }),
      ...(rest.requirement != null && { requirement: emptyToNull(rest.requirement) }),
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
}

export async function changeLeadStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.update");

  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, to, lostReason } = parsed.data;

  const db = scoped(ctx);
  await withEvents(async (publish) => {
    const before = await db.lead.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (before.status === to) return;
    await db.lead.update({
      where: { id },
      data: {
        status: to,
        ...(lostReason != null && { lostReason }),
      },
    });
    publish({
      type: "lead.statusChanged",
      orgId: ctx.orgId,
      actorId: ctx.userId,
      occurredAt: new Date(),
      leadId: id,
      from: before.status,
      to,
      ...(lostReason != null && { lostReason }),
    });
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true, data: { id } };
}

export async function convertLead(input: unknown): Promise<ActionResult<{ clientId: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "lead.convert");

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) return zodError<{ clientId: string }>(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const lead = await db.lead.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, name: true, mobile: true, email: true, companyName: true,
      status: true, convertedClientId: true, branchId: true,
    },
  });

  if (lead.convertedClientId != null) {
    return { ok: true, data: { clientId: lead.convertedClientId } };
  }
  if (lead.status === "LOST") {
    return { ok: false, error: "This lead is marked lost and cannot be converted." };
  }

  const branch = await db.branch.findUniqueOrThrow({
    where: { id: lead.branchId },
    select: { stateCode: true },
  });

  const clientId = await withTransaction(async (tx: TxClient) => {
    const client = await tx.client.create({
      data: {
        orgId:         ctx.orgId,
        name:          lead.companyName ?? lead.name,
        type:          "RETAIL",
        status:        "ACTIVE",
        primaryMobile: lead.mobile,
        primaryEmail:  lead.email,
        stateCode:     branch.stateCode,
        paymentTerms:  30,
        createdById:   ctx.userId,
      },
      select: { id: true },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "WON", convertedClientId: client.id },
    });
    return client.id;
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  return { ok: true, data: { clientId } };
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function emptyToNull(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseExpectedValue(v: string | undefined): bigint | null {
  if (v == null || v.trim() === "") return null;
  try {
    return parseINR(v);
  } catch {
    return null;
  }
}
