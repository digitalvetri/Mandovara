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
