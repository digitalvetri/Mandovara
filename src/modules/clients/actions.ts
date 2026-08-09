"use server";

// Client server actions.
//   - permissions checked (Rule 8)
//   - Zod validation (schema.ts)
//   - db.scoped(ctx) so tenant scope + audit apply (Rules 1, 4)
//
// Domain events for client lifecycle aren't yet in the DomainEvent union;
// TODO for the follow-up kernel diff: add ClientCreatedEvent /
// ClientStatusChangedEvent and publish here.

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import {
  createClientSchema, updateClientSchema, setStatusSchema,
} from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "client.create");

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const created = await db.client.create({
    data: {
      orgId:         ctx.orgId,
      name:          d.name,
      type:          d.type,
      status:        "ACTIVE",
      primaryMobile: normaliseMobile(d.primaryMobile),
      primaryEmail:  emptyToNull(d.primaryEmail),
      gstin:         upper(emptyToNull(d.gstin)),
      pan:           upper(emptyToNull(d.pan)),
      stateCode:     d.stateCode,
      paymentTerms:  d.paymentTerms,
      ...(d.architectId != null && d.architectId.length > 0 && { architectId: d.architectId }),
      createdById:   ctx.userId,
      ...(d.billingAddress && {
        addresses: {
          create: [{
            label:     d.billingAddress.label,
            line1:     d.billingAddress.line1,
            line2:     emptyToNull(d.billingAddress.line2),
            city:      d.billingAddress.city,
            stateCode: d.billingAddress.stateCode,
            pincode:   d.billingAddress.pincode,
            isDefault: true,
          }],
        },
      }),
    },
    select: { id: true },
  });

  if (d.creditLimit != null && d.creditLimit.trim().length > 0) {
    const limit = parseCreditLimit(d.creditLimit);
    if (limit != null) {
      requirePermission(ctx, "client.creditLimit");
      await db.creditLimit.create({
        data: { clientId: created.id, limitPaise: limit, updatedById: ctx.userId },
      });
    }
  }

  revalidatePath("/clients");
  return { ok: true, data: { id: created.id } };
}

export async function updateClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "client.update");

  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  // billingAddress on update is currently no-op — address CRUD lands in the
  // dedicated address sub-form (follow-up).
  const { id, creditLimit, billingAddress, ...rest } = parsed.data;
  void billingAddress;

  const db = scoped(ctx);
  await db.client.update({
    where: { id },
    data: {
      ...(rest.name != null          && { name: rest.name }),
      ...(rest.type != null          && { type: rest.type }),
      ...(rest.primaryMobile != null && { primaryMobile: normaliseMobile(rest.primaryMobile) }),
      ...(rest.primaryEmail != null  && { primaryEmail: emptyToNull(rest.primaryEmail) }),
      ...(rest.gstin != null         && { gstin: upper(emptyToNull(rest.gstin)) }),
      ...(rest.pan != null           && { pan: upper(emptyToNull(rest.pan)) }),
      ...(rest.stateCode != null     && { stateCode: rest.stateCode }),
      ...(rest.paymentTerms != null  && { paymentTerms: rest.paymentTerms }),
      // architectId: empty string → clear the link (SetNull FK).
      ...(rest.architectId !== undefined && {
        architectId: rest.architectId.length > 0 ? rest.architectId : null,
      }),
    },
  });

  if (creditLimit != null && creditLimit.trim().length > 0) {
    const limit = parseCreditLimit(creditLimit);
    if (limit != null) {
      requirePermission(ctx, "client.creditLimit");
      await db.creditLimit.upsert({
        where:  { clientId: id },
        create: { clientId: id, limitPaise: limit, updatedById: ctx.userId },
        update: { limitPaise: limit, updatedById: ctx.userId },
      });
    }
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, data: { id } };
}

export async function setClientStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "client.update");

  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, status } = parsed.data;

  if (status === "BLACKLISTED") requirePermission(ctx, "client.blacklist");

  const db = scoped(ctx);
  await db.client.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────

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
  const t = m.trim();
  return t.startsWith("+91") ? t : `+91${t}`;
}
function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function upper(v: string | null): string | null {
  return v == null ? null : v.toUpperCase();
}
function parseCreditLimit(v: string): bigint | null {
  try { return parseINR(v); } catch { return null; }
}
