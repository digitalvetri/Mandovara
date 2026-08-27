// Share-token minting for the public /q/[token] surface.
//
// The token is the entire credential for an unauthenticated client
// viewing (and now accepting) a quotation, so it is 256 bits of CSPRNG
// and expires after 90 days.
//
// Minted lazily on render rather than at quotation creation: most
// quotations are never shared, and a token that exists is a token that
// can leak. Both surfaces that can send a quotation — the quotation
// header and the lead page's inline Send — call this before building
// the message, because a null token silently degrades the share link to
// /quotations/[id], which is an authenticated route the client cannot
// open.

import { randomBytes } from "node:crypto";
import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export interface TokenState {
  shareToken:          string | null;
  shareTokenExpiresAt: Date | null;
}

/**
 * Return a live share token for `quotationId`, minting a fresh one if
 * none exists or the current one has expired. Pass the row's current
 * token state to avoid a re-read when the caller already has it.
 */
export async function ensureShareToken(
  ctx:         RequestContext,
  quotationId: string,
  current?:    TokenState,
): Promise<string> {
  const now = new Date();
  const db  = scoped(ctx);

  let state = current;
  if (!state) {
    const row = await db.quotation.findUnique({
      where:  { id: quotationId },
      select: { shareToken: true, shareTokenExpiresAt: true },
    });
    state = row ?? { shareToken: null, shareTokenExpiresAt: null };
  }

  const live =
    state.shareToken !== null &&
    (state.shareTokenExpiresAt === null || state.shareTokenExpiresAt >= now);
  if (live && state.shareToken) return state.shareToken;

  const shareToken = randomBytes(32).toString("hex");
  await db.quotation.update({
    where: { id: quotationId },
    data:  { shareToken, shareTokenExpiresAt: new Date(now.getTime() + NINETY_DAYS_MS) },
  });
  return shareToken;
}

interface SendableRow extends TokenState { id: string; status: string }

/**
 * Mint live share tokens for every quotation on a page that can still be
 * sent, mutating each row's `shareToken` in place.
 *
 * Note there is no `shareToken === null` filter: an EXPIRED token is
 * non-null but dead, and getQuotationByShareToken rejects it — so
 * skipping non-null rows would hand the client a /q/<token> link that
 * 404s. ensureShareToken decides liveness from the expiry instead.
 */
export async function ensureShareTokensForSending<T extends SendableRow>(
  ctx:  RequestContext,
  rows: T[],
): Promise<void> {
  const sendable = rows.filter((r) => ["DRAFT", "REVISED", "SENT"].includes(r.status));
  await Promise.all(sendable.map(async (r) => {
    r.shareToken = await ensureShareToken(ctx, r.id, {
      shareToken:          r.shareToken,
      shareTokenExpiresAt: r.shareTokenExpiresAt,
    });
  }));
}
