// What a measurement round is ABOUT.
//
// Until 2026-08-27 the answer was always "a project", so every read
// path returned a `project: { id, name, number, clientName }` block and
// every screen rendered it directly. Leads became measurable on that
// date, and a lead has no project and no client — so the answer is now
// one of two things, and this is the shape that says so.
//
// Deliberately NOT modelled as `project | null` plus `lead | null`:
// every consumer would then carry the same three-line branch, and the
// one that forgot it would render a blank header rather than fail. One
// resolved subject, one set of fields, one href.
//
// Leads are referenced by plain id with no Prisma relation — the same
// convention Quotation.leadId has used since FIXES-01 §5.1 (no leadId
// column in this schema carries an FK). So callers fetch the lead rows
// they need and hand them in.

export type SubjectKind = "PROJECT" | "LEAD";

export interface RoundSubject {
  kind: SubjectKind;
  /** Project id, or lead id. */
  id: string;
  /** Project name, or the lead's name. */
  name: string;
  /** MDV/PRJ-2608-0042, or the lead's MDV/ENQ-… number. */
  number: string;
  /**
   * The client for a project. For a lead there is no client yet, and
   * saying so plainly beats an empty cell — the whole point of a
   * lead-scoped measurement is that nobody has committed to anything.
   */
  partyName: string;
  /** Where clicking the subject goes. */
  href: string;
}

export interface ProjectSubjectRow {
  id: string;
  name: string;
  number: string;
  client: { name: string };
}

export interface LeadSubjectRow {
  id: string;
  name: string;
  number: string;
}

export function projectSubject(p: ProjectSubjectRow): RoundSubject {
  return {
    kind:      "PROJECT",
    id:        p.id,
    name:      p.name,
    number:    p.number,
    partyName: p.client.name,
    href:      `/projects/${p.id}`,
  };
}

export function leadSubject(l: LeadSubjectRow): RoundSubject {
  return {
    kind:      "LEAD",
    id:        l.id,
    name:      l.name,
    number:    l.number,
    partyName: "Lead — not yet a client",
    href:      `/leads/${l.id}`,
  };
}

/**
 * Resolve a round's subject from whichever side is populated.
 *
 * The XOR is enforced by a DB CHECK on both Room and Measurement, so
 * "neither" is unreachable — but a round read through a stale client, or
 * a lead deleted out from under a measurement, would land here. Falling
 * back to a visible placeholder beats throwing inside a list render.
 */
export function resolveSubject(
  project: ProjectSubjectRow | null | undefined,
  lead:    LeadSubjectRow   | null | undefined,
): RoundSubject {
  if (project) return projectSubject(project);
  if (lead)    return leadSubject(lead);
  return {
    kind: "LEAD", id: "", name: "Unassigned", number: "—",
    partyName: "No project or lead", href: "/measurements",
  };
}

/**
 * Where a round's detail screen lives for this subject.
 *
 * Both routes render the same `RoundDetailView`; they differ only in the
 * parent whose breadcrumb and room list they resolve. Keeping the two
 * paths behind one function means a list row never has to know which
 * kind of round it is holding.
 */
export function roundHref(subject: RoundSubject, roundId: string): string {
  return subject.kind === "PROJECT"
    ? `/projects/${subject.id}/measurements/${roundId}`
    : `/leads/${subject.id}/measurements/${roundId}`;
}

// ── Route-param encoding for the field PWA ───────────────────────────
//
// /m/measure/[projectId] has twelve component files under it. Rather
// than fork that whole tree for leads, the segment is treated as a
// *subject* id: a bare cuid is a project (every existing link and every
// queued offline item keeps working untouched), and a "lead-" prefix
// means a lead. One resolver at the page, no route duplication.

export const LEAD_PARAM_PREFIX = "lead-";

export function encodeSubjectParam(subject: { kind: SubjectKind; id: string }): string {
  return subject.kind === "LEAD" ? `${LEAD_PARAM_PREFIX}${subject.id}` : subject.id;
}

export function decodeSubjectParam(param: string): { kind: SubjectKind; id: string } {
  return param.startsWith(LEAD_PARAM_PREFIX)
    ? { kind: "LEAD",    id: param.slice(LEAD_PARAM_PREFIX.length) }
    : { kind: "PROJECT", id: param };
}
