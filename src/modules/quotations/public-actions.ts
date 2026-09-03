"use server";

// Client-facing quotation decisions, taken from the public share link.
//
// These run unauthenticated: there is no RequestContext, so they use
// authBootstrapPrisma (which bypasses RLS) exactly as public-query does.
// The 256-bit share token IS the credential — every function below
// re-resolves the quotation from the token and never trusts an id from
// the caller.
//
// Deliberately narrow. The only state change reachable from the public
// internet is SENT → ACCEPTED, and only for a token that is unexpired
// and belongs to a quotation currently in SENT. Everything else
// ("request changes") is recorded as an inbound message and leaves the
// status untouched, so nothing a client taps can put a quotation into a
// terminal state the studio cannot undo.

import { revalidatePath } from "next/cache";
import { authBootstrapPrisma as db } from "@/kernel/db/client";
import { bus } from "@/kernel/events/bus";
import "@/kernel/events/register";

export interface PublicActionResult {
  ok: boolean;
  error?: string;
  /** Set when the decision landed, so the page can render the confirmation. */
  status?: string;
}

interface Resolved {
  id: string; status: string; orgId: string; ownerId: string;
  leadId: string | null; clientId: string | null; projectId: string | null;
  number: string;
}

async function resolveByToken(token: string): Promise<Resolved | null> {
  if (!token || token.length < 16) return null;
  const q = await db.quotation.findUnique({
    where: { shareToken: token },
    select: {
      id: true, status: true, organizationId: true, ownerId: true,
      leadId: true, clientId: true, projectId: true, number: true,
      shareTokenExpiresAt: true,
    },
  });
  if (!q) return null;
  if (q.shareTokenExpiresAt && q.shareTokenExpiresAt < new Date()) return null;
  return {
    id: q.id, status: q.status, orgId: q.organizationId, ownerId: q.ownerId,
    leadId: q.leadId, clientId: q.clientId, projectId: q.projectId, number: q.number,
  };
}

/**
 * The client taps "Accept this quotation" on /q/[token].
 *
 * This is the trigger that was missing entirely before 2026-08-27: the
 * old flow marked a quote ACCEPTED on the operator's behalf the moment
 * it was sent. Now acceptance is a thing the client actually does, and
 * it is what unlocks lead → client conversion on the lead page.
 *
 * Idempotent — a second tap on an already-accepted quote succeeds
 * quietly rather than erroring at someone who double-clicked.
 */
export async function acceptQuotationByToken(
  token: string,
  acceptedName?: string,
): Promise<PublicActionResult> {
  const q = await resolveByToken(token);
  if (!q) return { ok: false, error: "This quotation link is no longer valid. Please ask us for a fresh link." };
  if (q.status === "ACCEPTED") return { ok: true, status: "ACCEPTED" };
  if (q.status !== "SENT") {
    return { ok: false, error: `This quotation can no longer be accepted online (${q.status.toLowerCase()}). Please contact us.` };
  }

  // Guarded update — a concurrent staff acceptance or a revision landing
  // between the read and the write leaves this a no-op rather than
  // overwriting a newer state.
  const res = await db.quotation.updateMany({
    where: { id: q.id, status: "SENT" },
    data:  { status: "ACCEPTED" },
  });
  if (res.count === 0) return { ok: true, status: "ACCEPTED" };

  try {
    await db.communicationLog.create({
      data: {
        organizationId: q.orgId,
        idempotencyKey: `qt-public-accept:${q.id}`,
        channel:        "IN_APP",
        direction:      "IN",
        leadId:    q.leadId    ?? null,
        clientId:  q.clientId  ?? null,
        projectId: q.projectId ?? null,
        body: acceptedName?.trim()
          ? `Quotation ${q.number} accepted online by ${acceptedName.trim()}.`
          : `Quotation ${q.number} accepted online via the share link.`,
        status:      "DELIVERED",
        deliveredAt: new Date(),
      },
    });
  } catch (e) {
    console.warn("acceptQuotationByToken: log write failed (best-effort):", e);
  }

  // Downstream side-effects (milestone tick, project stage advance) run
  // off the same event the staff path publishes. actorId is the quote's
  // owner — the client has no user row to attribute this to.
  //
  // No order is auto-created here: a lead-scoped quote has no project to
  // hang one off, and a client-scoped one is better raised by staff who
  // can confirm the advance first.
  try {
    await bus.publish({
      type:        "quotation.accepted",
      orgId:       q.orgId,
      actorId:     q.ownerId,
      occurredAt:  new Date(),
      quotationId: q.id,
      clientId:    q.clientId ?? "",
    });
  } catch (e) {
    console.warn("acceptQuotationByToken: event publish failed (best-effort):", e);
  }

  revalidatePath(`/q/${token}`);
  revalidatePath(`/quotations/${q.id}`);
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { ok: true, status: "ACCEPTED" };
}

/**
 * The client taps "Request changes" and types what they want adjusted.
 *
 * Deliberately does NOT set REJECTED. The original reason was that
 * REJECTED had no outgoing transitions, so one tap from a client who
 * merely wanted a different fabric would strand the quotation. That is
 * no longer true — REJECTED became recoverable on 2026-09-04 when the
 * transition table was widened (see ./transitions.ts) — but the
 * behaviour stays, for a better reason: "send me a different fabric" is
 * not "no". Recording it as a rejection would put a lost-deal figure in
 * the reports for a client who is still buying. The note lands as an
 * inbound message and a follow-up for the quote's owner; the quote stays
 * SENT and revisable.
 */
export async function requestQuotationChangesByToken(
  token: string,
  note: string,
): Promise<PublicActionResult> {
  const trimmed = note.trim();
  if (trimmed.length < 3)  return { ok: false, error: "Please tell us what you'd like changed." };
  if (trimmed.length > 1000) return { ok: false, error: "Please keep it under 1000 characters." };

  const q = await resolveByToken(token);
  if (!q) return { ok: false, error: "This quotation link is no longer valid. Please ask us for a fresh link." };

  try {
    await db.communicationLog.create({
      data: {
        organizationId: q.orgId,
        idempotencyKey: `qt-public-changes:${q.id}:${Math.floor(Date.now() / 1000)}`,
        channel:        "IN_APP",
        direction:      "IN",
        leadId:    q.leadId    ?? null,
        clientId:  q.clientId  ?? null,
        projectId: q.projectId ?? null,
        body:      `Change request on ${q.number}: ${trimmed}`,
        status:      "DELIVERED",
        deliveredAt: new Date(),
      },
    });
    await db.followUp.create({
      data: {
        organizationId: q.orgId,
        refType: "QUOTATION",
        refId:   q.id,
        ownerId: q.ownerId,
        dueAt:   new Date(),
        note:    `Client requested changes on ${q.number}: ${trimmed}`,
      },
    });
  } catch (e) {
    console.error("requestQuotationChangesByToken failed:", e);
    return { ok: false, error: "We couldn't record that just now. Please call us on +91 89404 30051." };
  }

  revalidatePath(`/q/${token}`);
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { ok: true, status: q.status };
}
