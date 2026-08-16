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
  // Auto-generate vendor code: VEN-NNN (sequential per org, not atomic — acceptable for low-volume admin)
  const vendorCount = await db.vendor.count({ where: { organizationId: ctx.orgId } });
  const code = `VEN-${String(vendorCount + 1).padStart(3, "0")}`;

  try {
    const created = await db.vendor.create({
      data: {
        organizationId: ctx.orgId,
        code,
        name:             d.name,
        mobile:           normaliseMobile(d.mobile),
        email:            emptyToNull(d.email),
        gstin:            emptyToNull(d.gstin)?.toUpperCase() ?? null,
        paymentTermsDays: d.paymentTermsDays,
        leadTimeDays:     d.leadTimeDays,
        brandIds:         d.brandIds,
        ...(d.rating != null && { rating: d.rating }),
      },
      select: { id: true },
    });
    revalidatePath("/purchase/vendors");
    return { ok: true, data: created };
  } catch (e: unknown) {
    // FIXES-01 §8 — never let a create action throw. A thrown server
    // action returns a rejected promise that the client-side handler
    // sees as an unhandled rejection; the button hangs and the user
    // gets no feedback. Always surface an error message instead.
    if (isUniqueConstraint(e)) {
      return { ok: false, error: "Vendor code conflict — please retry (someone created a vendor in the same instant)." };
    }
    console.error("createVendor failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not create vendor: ${e.message}` : "Could not create vendor",
    };
  }
}

export async function updateVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "vendor.update");
  const parsed = updateVendorSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, ...rest } = parsed.data;

  const db = scoped(ctx);
  try {
    await db.vendor.update({
      where: { id },
      data: {
        ...(rest.name != null             && { name: rest.name }),
        ...(rest.mobile != null           && { mobile: normaliseMobile(rest.mobile) }),
        ...(rest.email != null            && { email: emptyToNull(rest.email) }),
        ...(rest.gstin != null            && { gstin: emptyToNull(rest.gstin)?.toUpperCase() ?? null }),
        ...(rest.paymentTermsDays != null && { paymentTermsDays: rest.paymentTermsDays }),
        ...(rest.leadTimeDays != null     && { leadTimeDays: rest.leadTimeDays }),
        ...(rest.brandIds != null         && { brandIds: rest.brandIds }),
        ...(rest.rating !== undefined     && { rating: rest.rating }),
      },
    });
    revalidatePath("/purchase/vendors");
    revalidatePath(`/purchase/vendors/${id}`);
    return { ok: true, data: { id } };
  } catch (e: unknown) {
    console.error("updateVendor failed:", e);
    return {
      ok:    false,
      error: e instanceof Error ? `Could not update vendor: ${e.message}` : "Could not update vendor",
    };
  }
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
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

function isUniqueConstraint(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
