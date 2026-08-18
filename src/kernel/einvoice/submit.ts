// IRN submission and cancellation policy. Pure decision logic — the caller
// owns the database writes, so this stays testable without a GSP or a DB.
//
// §14 Phase 6 requires: async, retryable, billing works with the GSP down,
// and the 24-hour cancel rule.

import { buildIrnPayload } from "./payload";
import { isEInvoicingConfigured } from "./gsp";
import { EInvoiceError, type EInvoiceSource, type GspClient, type IrnResult } from "./types";

export type IrnStatus = "NOT_REQUIRED" | "PENDING" | "GENERATED" | "FAILED" | "CANCELLED";

export interface SubmitOutcome {
  status:  IrnStatus;
  result?: IrnResult;
  error?:  string;
  /** true when a later attempt could still succeed — the row stays PENDING. */
  retryable?: boolean;
}

/**
 * Register an invoice for an IRN.
 *
 * Never throws: an invoice must remain issuable when the GSP is down, so every
 * failure is returned as an outcome for the caller to persist.
 */
export async function submitForIrn(
  src: EInvoiceSource,
  gsp: GspClient,
  opts: { configured?: boolean } = {},
): Promise<SubmitOutcome> {
  const configured = opts.configured ?? isEInvoicingConfigured();

  // Not applicable (below the AATO threshold, or no GSP wired). Billing
  // proceeds untouched — this is the default state of the system.
  if (!configured) return { status: "NOT_REQUIRED" };

  let payload: Record<string, unknown>;
  try {
    payload = buildIrnPayload(src);
  } catch (e) {
    // A malformed document will never succeed; do not retry it.
    const err = e as EInvoiceError;
    return { status: "FAILED", error: err.message, retryable: false };
  }

  try {
    const result = await gsp.register(payload);
    return { status: "GENERATED", result };
  } catch (e) {
    const err = e as EInvoiceError;
    return {
      // Retryable failures stay PENDING so a worker picks them up again;
      // permanent rejections go to FAILED and need a human.
      status:    err.retryable ? "PENDING" : "FAILED",
      error:     err.message,
      retryable: err.retryable,
    };
  }
}

export const CANCEL_WINDOW_HOURS = 24;

export interface CancelCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * The portal refuses cancellation more than 24 hours after acknowledgement,
 * and refuses it twice. Enforced here so the UI can disable the button with a
 * true explanation instead of surfacing a portal error after the fact.
 */
export function canCancelIrn(
  invoice: { irnStatus: IrnStatus; ackDate: Date | null },
  now: Date,
): CancelCheck {
  if (invoice.irnStatus === "CANCELLED") {
    return { allowed: false, reason: "This e-invoice has already been cancelled." };
  }
  if (invoice.irnStatus !== "GENERATED") {
    return { allowed: false, reason: "No IRN has been generated for this invoice yet." };
  }
  if (!invoice.ackDate) {
    return { allowed: false, reason: "This IRN has no acknowledgement date recorded." };
  }
  const hours = (now.getTime() - invoice.ackDate.getTime()) / 3_600_000;
  if (hours > CANCEL_WINDOW_HOURS) {
    return {
      allowed: false,
      reason:
        `The 24-hour cancellation window closed ${Math.floor(hours - CANCEL_WINDOW_HOURS)}h ago. ` +
        `Raise a credit note instead.`,
    };
  }
  return { allowed: true };
}

/** Exponential backoff for the retry worker: 1m, 5m, 25m, capped at 2h. */
export function nextRetryDelayMs(attempt: number): number {
  const base = 60_000 * Math.pow(5, Math.max(0, attempt - 1));
  return Math.min(base, 2 * 60 * 60_000);
}
