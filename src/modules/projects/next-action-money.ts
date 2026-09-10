// The money-driven stages of a project: quote it, collect the advance, do
// the work, collect the balance, and only then bill.
//
// Split out of next-action.ts for the §10 300-line limit, but it is also
// the part of the resolver the owner corrected on 2026-09-10. It used to
// offer "Create invoice" first at every one of these stages — asking the
// studio to bill a client who had not agreed a price, and to bill before
// being paid. Keeping the whole corrected sequence in one file makes it
// readable as the sequence it is.

import type { RequestContext } from "@/kernel/auth/context";
import type { NextAction, ProjectSnapshot } from "./next-action";
import { hasAny } from "./next-action";

const PERM_CREATE_INVOICE = ["invoice.create"] as const;
const PERM_RECORD_ADVANCE = ["receipt.create"] as const;
const PERM_BOOK_INSTALL   = ["sitelog.create", "project.update"] as const;

export function resolveMoneyStageAction(
  ctx:     RequestContext,
  project: ProjectSnapshot,
): NextAction {
  const { stage, id, clientId } = project;

  switch (stage) {
    case "ENQUIRY":
    case "SITE_VISIT":
    case "MEASUREMENT":
    case "QUOTATION": {
      const received = project.money?.advanceReceived ?? 0n;
      const owed     = project.money?.outstanding ?? 0n;

      // A price is out and money is still to come — chase the money.
      if (project.hasQuotation && owed > 0n) {
        const enabled = hasAny(ctx, PERM_RECORD_ADVANCE);
        return {
          kind:  "RECORD_ADVANCE",
          label: received > 0n ? "Part paid — balance to come" : "Quotation with the client",
          cta:   received > 0n ? "Record payment" : "Record advance",
          enabled,
          disabledReason: enabled ? null :
            "Payments are recorded by the accounts team.",
          href: clientId ? `/accounts/new?clientId=${clientId}` : `/accounts/new`,
          subLine: "Work starts once the advance is in.",
        };
      }

      const enabled = hasAny(ctx, ["quotation.create"]);
      return {
        kind:  "BUILD_QUOTATION",
        label: "Price the job",
        cta:   "Create quotation",
        enabled,
        disabledReason: enabled ? null :
          "Quotations are prepared by the sales team.",
        href: `/quotations/new?project=${id}`,
        subLine: "The quotation the client agrees is what they owe.",
      };
    }

    case "ORDERED": {
      // The client has agreed. From here the order is: collect the advance,
      // do the work, collect the balance, then bill.
      //
      // It used to be the reverse — raise an invoice, then ask for the
      // advance against it. That is why an advance paid on an uninvoiced
      // job had nothing to attach itself to, and why Accounts → Received
      // filled up with payments "not matched to a bill".
      const m = project.money;
      const invoiced   = m ? m.invoiceTotal > 0n : false;
      const advanceMet = m
        ? m.advanceRequired > 0n
            ? m.advanceReceived >= m.advanceRequired
            : m.advanceReceived > 0n
        : false;
      const stillOwed  = m?.outstanding ?? 0n;

      if (!advanceMet) {
        const enabled = hasAny(ctx, PERM_RECORD_ADVANCE);
        return {
          kind:  "RECORD_ADVANCE",
          label: "Quotation agreed — awaiting advance",
          cta:   "Record advance",
          enabled,
          disabledReason: enabled ? null :
            "Payments are recorded by the accounts team.",
          // Pre-select the client so /accounts/new opens with their open
          // jobs already loaded and the amount ready.
          href: clientId ? `/accounts/new?clientId=${clientId}` : `/accounts/new`,
          subLine: "Work starts once the advance is in.",
        };
      }

      // Paid in full and not yet billed — the closing act of the job.
      if (stillOwed <= 0n && !invoiced && (m?.agreedValue ?? 0n) > 0n) {
        const enabled = hasAny(ctx, PERM_CREATE_INVOICE);
        return {
          kind:  "CREATE_INVOICE",
          label: "Paid in full — ready to bill",
          cta:   "Create invoice",
          enabled,
          disabledReason: enabled ? null :
            "Invoices are raised by the accounts team.",
          href: `/invoicing/create?project=${id}`,
          subLine: "The bill goes out once the money is in.",
        };
      }

      // Advance in, balance still to come. Book install as the next visible
      // step, even before MAKE catches up — matches owner flow (Task 7).
      const enabled = hasAny(ctx, PERM_BOOK_INSTALL);
      return {
        kind:  "SCHEDULE_INSTALL",
        label: "Advance received — ready to install",
        cta:   "Book install visit",
        enabled,
        disabledReason: enabled ? null :
          "Install visits are scheduled by the sales team.",
        href: `/site-visits/new?projectId=${id}&purpose=HANDOVER`,
        ...(stillOwed > 0n ? { subLine: "Balance still to collect." } : {}),
      };
    }
  }

  // Unreachable — the caller only routes the five stages above here.
  return {
    kind:  "COMPLETED",
    label: "Nothing outstanding",
    cta:   "",
    enabled: false,
    disabledReason: null,
    href: null,
  };
}
