"use server";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createVendorSchema, updateVendorSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "vendor.create");
  const parsed = createVendorSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const created = await db.vendor.create({
    data: {
      orgId:       ctx.orgId,
      name:        d.name,
      mobile:      normaliseMobile(d.mobile),
      email:       emptyToNull(d.email),
      gstin:       upper(emptyToNull(d.gstin)),
      pan:         upper(emptyToNull(d.pan)),
      stateCode:   d.stateCode,
      paymentTerms: d.paymentTerms,
      status:      "ACTIVE",
    },
    select: { id: true },
  });
  revalidatePath("/purchase/vendors");
  return { ok: true, data: created };
}

export async function updateVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "vendor.update");
  const parsed = updateVendorSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, ...rest } = parsed.data;

  const db = scoped(ctx);
  await db.vendor.update({
    where: { id },
    data: {
      ...(rest.name != null    && { name: rest.name }),
      ...(rest.mobile != null  && { mobile: normaliseMobile(rest.mobile) }),
      ...(rest.email != null   && { email: emptyToNull(rest.email) }),
      ...(rest.gstin != null   && { gstin: upper(emptyToNull(rest.gstin)) }),
      ...(rest.pan != null     && { pan: upper(emptyToNull(rest.pan)) }),
      ...(rest.stateCode != null && { stateCode: rest.stateCode }),
      ...(rest.paymentTerms != null && { paymentTerms: rest.paymentTerms }),
    },
  });
  revalidatePath("/purchase/vendors");
  revalidatePath(`/purchase/vendors/${id}`);
  return { ok: true, data: { id } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
function normaliseMobile(m: string): string { const t = m.trim(); return t.startsWith("+91") ? t : `+91${t}`; }
function emptyToNull(v: string | undefined | null): string | null { if (v == null) return null; const t = v.trim(); return t.length === 0 ? null : t; }
function upper(v: string | null): string | null { return v == null ? null : v.toUpperCase(); }
