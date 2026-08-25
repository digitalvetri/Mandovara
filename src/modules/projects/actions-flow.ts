"use server";

// Flow-shortcut actions that don't fit the CRUD shape in actions.ts.
// Batch B (25 Aug 2026) — currently just the "Skip firm quote"
// shortcut for jobs where the client agrees without a formal quote.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

// Move the project straight from Enquiry/Site Visit/Measurement/Quotation
// to Advance Awaited (internal: ORDERED). Guarded — refuses if the
// project has already progressed past Quotation.
export async function skipFirmQuote(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");
  const db = scoped(ctx);
  const project = await db.project.findUnique({
    where:  { id },
    select: { stage: true },
  });
  if (!project) return { ok: false, error: "Project not found." };
  const allowedFrom = ["ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION"] as const;
  if (!allowedFrom.includes(project.stage as typeof allowedFrom[number])) {
    return {
      ok: false,
      error: `Cannot skip quote — project is already at ${project.stage}.`,
    };
  }
  await db.project.update({
    where: { id },
    data:  { stage: "ORDERED" },  // → Advance Awaited phase
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true, data: { id } };
}
