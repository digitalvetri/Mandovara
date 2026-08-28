// Who can see whose leads.
//
// `lead.viewOthers` has existed in the permission catalogue since the RBAC
// module was written, and the seed granted it — but nothing ever read it.
// Every employee with `lead.view` saw the whole pipeline, which is the bug
// the owner reported (2026-08-28): "leads assigned to an employee should
// only display to that particular employee".
//
// The rule, in one place so a list and its badge count can never disagree:
//
//   has lead.viewOthers  → every lead in the org
//   otherwise            → only leads where ownerId === the current user
//
// OWNER is unaffected: isOwnerRole short-circuits to allPermissions() in
// session.ts, so owners hold `lead.viewOthers` and see everything.
//
// Deliberately a WHERE narrowing rather than a thrown ForbiddenError.
// `lead.view` still gates the module as a whole; an employee without
// `viewOthers` is not forbidden from /leads, they simply get a shorter
// list. Throwing here would 500 the page for eight of nine seeded roles
// and turn the RBAC matrix red.

import type { RequestContext } from "@/kernel/auth/context";

/** True when this user is allowed to see leads owned by other people. */
export function canViewOthersLeads(ctx: RequestContext): boolean {
  return ctx.permissions.has("lead.viewOthers");
}

/**
 * Prisma `where` fragment restricting a lead query to what this user may
 * see. `{}` for users who can see everything, so it is always safe to
 * spread or AND into an existing filter.
 */
export function leadVisibilityWhere(
  ctx: RequestContext,
): Record<string, unknown> {
  return canViewOthersLeads(ctx) ? {} : { ownerId: ctx.userId };
}

/**
 * Guard for the single-lead paths — detail pages and every mutation.
 *
 * A narrowed list is not access control on its own: without this, an
 * employee who knew (or guessed) a lead id could still open
 * /leads/<id>, edit it, convert it, or delete it. Server-side, per
 * CLAUDE.md rule 11 — not UI visibility.
 */
export function canTouchLead(
  ctx: RequestContext,
  lead: { ownerId: string },
): boolean {
  return canViewOthersLeads(ctx) || lead.ownerId === ctx.userId;
}
