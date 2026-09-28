// Quotation status transitions — the single source of truth for BOTH
// the server guard in actions-part2.ts and the picker the operator sees.
//
// A plain module, not "use server": a server-action file may only export
// async functions, so the map could not live there and be imported by a
// client component. Keeping one copy matters more than where it lives —
// two hand-maintained lists would drift, and the drift would show up as
// a menu entry that always fails.

export const QUOTATION_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT:            ["PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "REJECTED"],
  APPROVED:         ["SENT", "ACCEPTED", "DRAFT", "REJECTED", "EXPIRED"],
  SENT:             ["ACCEPTED", "REVISED", "REJECTED", "EXPIRED", "DRAFT"],
  REVISED:          ["SENT", "ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"],
  ACCEPTED:         ["SENT", "REVISED", "REJECTED"],
  REJECTED:         ["DRAFT", "SENT", "ACCEPTED"],
  EXPIRED:          ["DRAFT", "SENT", "REVISED"],
};

/** Everyday wording. The enum names are shouted database values; these
 *  are what the studio actually calls each state. */
export const QUOTATION_STATUS_LABEL: Record<string, string> = {
  DRAFT:            "Draft",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED:         "Approved",
  SENT:             "Sent to client",
  REVISED:          "Revised",
  ACCEPTED:         "Accepted",
  REJECTED:         "Rejected",
  EXPIRED:          "Expired",
};

/** One line of context per target, shown under the label in the picker
 *  so nobody has to guess what a status will set in motion. */
export const QUOTATION_STATUS_HINT: Record<string, string> = {
  DRAFT:            "Back to editing — nothing is sent",
  PENDING_APPROVAL: "Waiting for the owner to approve",
  APPROVED:         "Approved internally, ready to send",
  SENT:             "Shared with the client",
  REVISED:          "Superseded by a newer version",
  ACCEPTED:         "Client agreed — raises the order",
  REJECTED:         "Client said no",
  EXPIRED:          "Past its validity date",
};

/**
 * The permission a given target status demands. Mirrors the branch at
 * the top of setQuotationStatus so the UI can grey out what the server
 * would refuse, rather than offering it and failing on click.
 *
 * This is a courtesy. The server check is the rule (CLAUDE.md #11).
 */
export function permissionForStatus(target: string): string {
  if (target === "SENT" || target === "ACCEPTED") return "quotation.send";
  if (target === "APPROVED") return "quotation.approve";
  return "quotation.update";
}

/** Targets reachable from `current`, filtered to what this user may do. */
export function allowedStatusTargets(
  current: string,
  permissions: ReadonlySet<string> | readonly string[],
): string[] {
  const has = Array.isArray(permissions)
    ? (k: string) => permissions.includes(k)
    : (k: string) => (permissions as ReadonlySet<string>).has(k);
  return (QUOTATION_TRANSITIONS[current] ?? []).filter((t) => has(permissionForStatus(t)));
}

/** Statuses whose lines, notes and dates can be changed in the editor. */
export const EDITABLE_STATUSES: readonly string[] = ["DRAFT", "REVISED"];

/**
 * Where "Edit quotation" moves a quote that is no longer editable, or
 * null when it already is (or cannot be reopened).
 *
 * Owner request, 2026-09-28: a sent quotation needs an obvious way back
 * into the editor to revise it. DRAFT wherever the map allows it —
 * REVISED is what a superseded version reads — and REVISED only from
 * ACCEPTED, whose one way back into editing it is. Both are ordinary
 * moves in QUOTATION_TRANSITIONS, so setQuotationStatus applies its usual
 * guards (permission, and no reopening once an order has been raised).
 *
 * Not offered while a quote is awaiting approval: that is the approver's
 * call (Approve, or send it back), and setQuotationStatus records a
 * PENDING_APPROVAL → DRAFT move as "Returned to draft by approver".
 */
export function editTargetFor(current: string): "DRAFT" | "REVISED" | null {
  if (EDITABLE_STATUSES.includes(current) || current === "PENDING_APPROVAL") return null;
  const allowed = QUOTATION_TRANSITIONS[current] ?? [];
  if (allowed.includes("DRAFT")) return "DRAFT";
  if (allowed.includes("REVISED")) return "REVISED";
  return null;
}
