"use server";

// Sample library mutations — issue and return of physical sample books.
// Extracted from catalog/actions.ts to keep that file under the 300-line
// boundary. Same conventions: requirePermission → Zod parse → scoped
// client → revalidate.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

function zodError<T>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

const IssueSampleSchema = z.object({
  sampleBookId: z.string().min(1),
  issuedToType: z.enum(["CLIENT", "ARCHITECT", "STAFF"]),
  clientId: z.string().min(1).optional().nullable(),
  architectId: z.string().min(1).optional().nullable(),
  userId: z.string().min(1).optional().nullable(),
  dueAt: z.date(),
  depositAmount: z.bigint().min(0n).default(0n),
  notes: z.string().max(500).optional(),
});

export async function issueSampleBook(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const parsed = IssueSampleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  const [issue] = await db.$transaction([
    db.sampleIssue.create({
      data: { organizationId: ctx.orgId, ...d },
      select: { id: true },
    }),
    db.sampleBook.update({
      where: { id: d.sampleBookId },
      data: { status: "ISSUED" },
    }),
  ]);

  revalidatePath("/samples");
  return { ok: true, data: { id: issue.id } };
}

export async function returnSampleBook(
  issueId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const db = scoped(ctx);

  const issue = await db.sampleIssue.update({
    where: { id: issueId },
    data: { returnedAt: new Date() },
    select: { id: true, sampleBookId: true },
  });

  await db.sampleBook.update({
    where: { id: issue.sampleBookId },
    data: { status: "IN_LIBRARY" },
  });

  revalidatePath("/samples");
  return { ok: true, data: { id: issue.id } };
}

export async function returnSampleByBookId(
  bookId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "catalog.update");

  const db = scoped(ctx);

  const openIssue = await db.sampleIssue.findFirst({
    where:   { sampleBookId: bookId, returnedAt: null },
    orderBy: { issuedAt: "desc" },
    select:  { id: true },
  });
  if (!openIssue) return { ok: false, error: "No open issue found for this book." };

  return returnSampleBook(openIssue.id);
}
