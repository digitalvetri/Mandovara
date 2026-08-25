"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const createAdvanceSchema = z.object({
  projectId:  z.string().cuid(),
  clientId:   z.string().cuid(),
  amount:     z.string().regex(/^\d+$/, "Amount must be a positive integer (paise)"),
  receivedAt: z.string().datetime(),
  mode:       z.enum(["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CARD"]),
  reference:  z.string().max(120).optional(),
});

export async function createAdvance(
  input: unknown,
): Promise<ActionResult<{ id: string; amount: bigint }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.create");

  const parsed = createAdvanceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const amountBig = BigInt(d.amount);
  if (amountBig <= 0n) return { ok: false, error: "Advance amount must be greater than zero." };

  const db = scoped(ctx);

  const project = await db.project.findUnique({
    where: { id: d.projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const advance = await db.advance.create({
    data: {
      organizationId: ctx.orgId,
      projectId:      d.projectId,
      clientId:       d.clientId,
      amount:         amountBig,
      receivedAt:     new Date(d.receivedAt),
      mode:           d.mode,
      reference:      d.reference ?? null,
    },
    select: { id: true, amount: true },
  });

  // Batch B (25 Aug 2026) — advance-payment gate. Once total advances
  // for this project cover the required advance (or when no order
  // exists yet, any positive advance), move project stage from
  // ORDERED (Advance Awaited phase) → PROCUREMENT (Installation phase).
  // Guarded — never regresses a project past Installation, never
  // touches CANCELLED / COMPLETED.
  try {
    const [totalAdvancesAgg, requiredAgg, project] = await Promise.all([
      db.advance.aggregate({
        where:  { projectId: d.projectId },
        _sum:   { amount: true },
      }),
      db.order.aggregate({
        where:  { projectId: d.projectId, status: { not: "CANCELLED" } },
        _sum:   { advanceRequired: true },
      }),
      db.project.findUnique({
        where:  { id: d.projectId },
        select: { stage: true },
      }),
    ]);
    const totalReceived = totalAdvancesAgg._sum.amount ?? 0n;
    const required      = requiredAgg._sum.advanceRequired ?? 0n;
    const gateOpen      = totalReceived >= required;
    const stageOk       = project?.stage === "ORDERED"
                       || project?.stage === "QUOTATION"
                       || project?.stage === "MEASUREMENT";
    if (gateOpen && stageOk) {
      await db.project.update({
        where: { id: d.projectId },
        data:  { stage: "PROCUREMENT" },  // → Installation phase
      });
    }
  } catch (err) {
    console.warn("advance-gate auto-advance failed (best-effort):", err);
  }

  revalidatePath(`/projects/${d.projectId}`);
  revalidatePath("/accounts");

  return { ok: true, data: { id: advance.id, amount: advance.amount } };
}

const listAdvancesSchema = z.object({
  projectId: z.string().cuid(),
});

export interface AdvanceRow {
  id:         string;
  amount:     bigint;
  adjusted:   bigint;
  receivedAt: Date;
  mode:       string;
  reference:  string | null;
}

export async function listAdvancesForProject(
  input: unknown,
): Promise<ActionResult<AdvanceRow[]>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.view");

  const parsed = listAdvancesSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const db = scoped(ctx);
  const rows = await db.advance.findMany({
    where:   { organizationId: ctx.orgId, projectId: parsed.data.projectId },
    orderBy: { receivedAt: "asc" },
    select:  { id: true, amount: true, adjusted: true, receivedAt: true, mode: true, reference: true },
  });

  return { ok: true, data: rows };
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
