// @ts-nocheck
"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
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

  const yymm = yymmFromDate(new Date());

  const created = await withTransaction(async (tx: TxClient) => {
    const code = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "CLI",
      yymm,
      prefix: "MDV",
    });

    const creditPaise =
      d.creditLimit && d.creditLimit.trim().length > 0
        ? (parseCreditLimit(d.creditLimit) ?? 0n)
        : 0n;

    return tx.client.create({
      data: {
        organizationId: ctx.orgId,
        code,
        name:           d.name,
        type:           d.type,
        mobile:         normaliseMobile(d.primaryMobile),
        email:          emptyToNull(d.primaryEmail),
        gstin:          upper(emptyToNull(d.gstin ?? "")),
        pan:            upper(emptyToNull(d.pan ?? "")),
        billingAddress: d.billingAddress ?? {},
        creditLimit:    creditPaise,
        ownerId:        ctx.userId,
      },
      select: { id: true },
    });
  });

  revalidatePath("/clients");
  return { ok: true, data: { id: created.id } };
}

export async function updateClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "client.update");

  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id, creditLimit, billingAddress, ...rest } = parsed.data;
  void billingAddress;

  const db = scoped(ctx);
  await db.client.update({
    where: { id },
    data: {
      ...(rest.name != null          && { name: rest.name }),
      ...(rest.type != null          && { type: rest.type }),
      ...(rest.primaryMobile != null && { mobile: normaliseMobile(rest.primaryMobile) }),
      ...(rest.primaryEmail != null  && { email: emptyToNull(rest.primaryEmail) }),
      ...(rest.gstin != null         && { gstin: upper(emptyToNull(rest.gstin)) }),
      ...(rest.pan != null           && { pan: upper(emptyToNull(rest.pan)) }),
    },
  });

  if (creditLimit != null && creditLimit.trim().length > 0) {
    const limit = parseCreditLimit(creditLimit);
    if (limit != null) {
      requirePermission(ctx, "client.creditLimit");
      await db.client.update({
        where: { id },
        data:  { creditLimit: limit },
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

  // status is not a field in the current Client schema — log and no-op for now.
  void status;

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
