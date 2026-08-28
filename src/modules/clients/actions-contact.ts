"use server";

// Contact people on a client record.
//
// The Client 360 page has listed contacts since it was built, but there
// has never been a way to put one there — `contact.create` sat in the
// permission catalogue with no action behind it, so the section could
// only ever say "No contact persons." The owner reported it as such
// (2026-08-28): "I cant able to add any contact information".

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const addContactSchema = z.object({
  clientId:    z.string().trim().min(1),
  name:        z.string().trim().min(2, "Name is required.").max(120),
  // Same shape the client form accepts — 10 digits, optionally +91 and
  // spacing, which is what people paste out of their phone.
  mobile:      z.string().trim().regex(/^[\d+\-\s]{6,20}$/, "Enter a valid mobile number."),
  designation: z.string().trim().max(80).optional(),
  email:       z.string().trim().email("Enter a valid email.").max(160).optional().or(z.literal("")),
});

const deleteContactSchema = z.object({ id: z.string().trim().min(1) });

function fieldErrors(e: z.ZodError): ActionResult {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = issue.path.join(".");
    if (k && !out[k]) out[k] = issue.message;
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: out };
}

export async function addClientContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "contact.create");

  const parsed = addContactSchema.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error) as ActionResult<{ id: string }>;
  const d = parsed.data;

  const db = scoped(ctx);
  // scoped() already constrains to the caller's org; this also turns a
  // wrong id into a clean message instead of an FK error.
  const client = await db.client.findUnique({
    where: { id: d.clientId }, select: { id: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const created = await db.contactPerson.create({
    data: {
      organizationId: ctx.orgId,
      clientId:       d.clientId,
      name:           d.name,
      mobile:         d.mobile,
      designation:    d.designation?.trim() ? d.designation.trim() : null,
      email:          d.email?.trim() ? d.email.trim() : null,
    },
    select: { id: true },
  });

  revalidatePath(`/clients/${d.clientId}`);
  return { ok: true, data: created };
}

export async function deleteClientContact(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  requirePermission(ctx, "contact.delete");

  const parsed = deleteContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = scoped(ctx);
  const existing = await db.contactPerson.findUnique({
    where: { id: parsed.data.id }, select: { id: true, clientId: true },
  });
  if (!existing) return { ok: false, error: "Contact not found." };

  await db.contactPerson.delete({ where: { id: existing.id } });
  revalidatePath(`/clients/${existing.clientId}`);
  return { ok: true };
}
