"use server";

// Sending a quotation, and recording what the client said back.
//
// Split from actions-part2 (2026-08-27, owner instruction) because the
// two events it covers used to be fused into one button:
//
//   BEFORE — "Send" fired a WhatsApp deep link, flipped the quote to
//   SENT, then immediately opened the Convert-lead-to-client modal and
//   set the quote to ACCEPTED on the operator's behalf. The lead became
//   a client the moment the quote was *sent*, and the client's actual
//   acceptance was never recorded — it was fabricated.
//
//   NOW — sendQuotation only sends. recordClientDecision is what marks
//   a quote ACCEPTED, and only that unlocks ConversionApprovalCard on
//   the lead page. Conversion stays a separate, owner-approved act.
//
// Every outbound send writes a CommunicationLog row and bumps
// Client.lastContactedAt, which is the convention the chase-score
// algorithm reads (docs/ACCOUNTS-PAGE.md §6.1).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { setQuotationStatus } from "./actions-part2";
import type { ActionResult } from "./actions";

const CHANNELS = ["whatsapp", "email", "copy_link"] as const;

const CHANNEL_TO_NOTIFY = {
  whatsapp:  "WHATSAPP",
  email:     "EMAIL",
  copy_link: "IN_APP",
} as const;

const sendSchema = z.object({
  id:      z.string().min(1),
  channel: z.enum(CHANNELS),
  body:    z.string().max(4000).optional(),
});

/**
 * Record that the quotation was shared with the client over `channel`,
 * and move DRAFT/REVISED → SENT. Already-SENT quotes are re-shareable:
 * the log row is written, the status is left alone.
 *
 * The deep link itself is fired client-side (wa.me / mailto) — this is
 * not the WhatsApp Cloud API, so there is no AutomationLog row and no
 * per-message cost. The CommunicationLog row exists so "when did we
 * last contact them" has an answer.
 */
export async function sendQuotation(input: unknown): Promise<ActionResult<{ id: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.send");

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { id, channel, body } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id },
    select: { id: true, status: true, leadId: true, clientId: true, projectId: true, number: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };

  // Status first — if the transition is refused we do not want a log row
  // claiming we sent something we did not.
  let status = q.status;
  if (q.status === "DRAFT" || q.status === "REVISED") {
    const res = await setQuotationStatus({ id, status: "SENT" });
    if (!res.ok) return { ok: false, error: res.error ?? "Could not mark the quotation as sent" };
    status = "SENT";
  }

  // Resolve the recipient for the log row.
  let toMobile: string | null = null;
  let toEmail:  string | null = null;
  if (q.clientId) {
    const c = await db.client.findUnique({ where: { id: q.clientId }, select: { mobile: true, email: true } });
    toMobile = c?.mobile ?? null; toEmail = c?.email ?? null;
  } else if (q.leadId) {
    const l = await db.lead.findUnique({ where: { id: q.leadId }, select: { mobile: true, email: true } });
    toMobile = l?.mobile ?? null; toEmail = l?.email ?? null;
  }

  // Best-effort: a logging failure must never lose the operator's send.
  try {
    await db.communicationLog.create({
      data: {
        organizationId: ctx.orgId,
        // One row per (quotation, channel, send) — the timestamp keeps
        // re-shares distinct while a double-click collapses into one.
        idempotencyKey: `qt-share:${id}:${channel}:${Math.floor(Date.now() / 1000)}`,
        channel:        CHANNEL_TO_NOTIFY[channel],
        direction:      "OUT",
        toMobile, toEmail,
        clientId:  q.clientId  ?? null,
        leadId:    q.leadId    ?? null,
        projectId: q.projectId ?? null,
        body:      body ?? `Quotation ${q.number} shared via ${channel}`,
        status:    "SENT",
        sentAt:    new Date(),
      },
    });
    if (q.clientId) {
      await db.client.update({ where: { id: q.clientId }, data: { lastContactedAt: new Date() } });
    }
  } catch (e) {
    console.warn("sendQuotation: communication log write failed (best-effort):", e);
  }

  revalidatePath(`/quotations/${id}`);
  if (q.leadId)    revalidatePath(`/leads/${q.leadId}`);
  if (q.projectId) revalidatePath(`/projects/${q.projectId}`);
  return { ok: true, data: { id, status } };
}

const decisionSchema = z.object({
  id:   z.string().min(1),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Staff-recorded client acceptance — the phone-call and in-person path.
 * The client's own tap on /q/[token] goes through acceptQuotationByToken
 * in public-actions.ts; both land on the same ACCEPTED status, which is
 * what ConversionApprovalCard gates on.
 */
export async function recordClientAcceptance(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.send");

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { id, note } = parsed.data;

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id },
    select: { id: true, status: true, leadId: true, number: true },
  });
  if (!q) return { ok: false, error: "Quotation not found" };
  if (q.status === "ACCEPTED") return { ok: true, data: { id } };
  if (q.status !== "SENT") {
    return { ok: false, error: `Only a sent quotation can be accepted — ${q.number} is ${q.status.toLowerCase()}.` };
  }

  const res = await setQuotationStatus({ id, status: "ACCEPTED" });
  if (!res.ok) return { ok: false, error: res.error ?? "Could not record the acceptance" };

  if (note) {
    try {
      await db.communicationLog.create({
        data: {
          organizationId: ctx.orgId,
          idempotencyKey: `qt-accept-note:${id}`,
          channel:        "IN_APP",
          direction:      "IN",
          leadId:         q.leadId ?? null,
          body:           note,
          status:         "DELIVERED",
        },
      });
    } catch (e) {
      console.warn("recordClientAcceptance: note log failed (best-effort):", e);
    }
  }

  revalidatePath(`/quotations/${id}`);
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { ok: true, data: { id } };
}
