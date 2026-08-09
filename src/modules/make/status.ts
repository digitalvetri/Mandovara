// MakeJob status lifecycle. Pure, unit-tested, no I/O.
//
// The Mandovara make loop moves a job through six work stations, with
// exactly one loop-back for rework:
//
//   QUEUED     — job created from order, waiting for cutting-table time
//   CUTTING    — fabric being cut per the cut list
//   STITCHING  — panels being sewn
//   FINISHING  — heading + eyelets + trim
//   QC         — supervisor inspection
//   READY      — packed for site, awaiting install collection
//   DELIVERED  — handed to installer for the site visit
//
// QC can pass forward to READY or fail back to CUTTING for rework
// (fabric problem) — no separate "REWORK" state; the cutting queue is
// the rework queue. Everything else is strictly forward.
//
// Kept as a pure map here so the server action, the kanban UI, and
// the smoke script all read from the same source of truth. If the
// lifecycle changes, only this file changes.

import type { MakeJobStatus } from "./schema";

// Adjacency list — for each state, the states you can move to.
// Terminal states (DELIVERED) map to an empty array.
const TRANSITIONS: Record<MakeJobStatus, readonly MakeJobStatus[]> = {
  QUEUED:     ["CUTTING"],
  CUTTING:    ["STITCHING"],
  STITCHING:  ["FINISHING"],
  FINISHING:  ["QC"],
  QC:         ["READY", "CUTTING"],   // pass forward, or fail back for rework
  READY:      ["DELIVERED"],
  DELIVERED:  [],
};

export function nextAllowedStatuses(current: MakeJobStatus): readonly MakeJobStatus[] {
  return TRANSITIONS[current];
}

export function canTransition(from: MakeJobStatus, to: MakeJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// A label + tone hint per transition so the UI doesn't have to bake
// business decisions ("QC pass" is a good-tone action, "back to
// cutting" is a bad-tone action) into a client component.
export type TransitionTone = "accent" | "good" | "bad";
export interface TransitionOption {
  to:    MakeJobStatus;
  label: string;
  tone:  TransitionTone;
}

const OPTIONS: Record<MakeJobStatus, readonly TransitionOption[]> = {
  QUEUED:     [{ to: "CUTTING",   label: "Start cutting",  tone: "accent" }],
  CUTTING:    [{ to: "STITCHING", label: "To stitching",   tone: "accent" }],
  STITCHING:  [{ to: "FINISHING", label: "To finishing",   tone: "accent" }],
  FINISHING:  [{ to: "QC",        label: "Send to QC",     tone: "accent" }],
  QC: [
    { to: "READY",   label: "QC pass — ready to install", tone: "good" },
    { to: "CUTTING", label: "QC fail — rework",           tone: "bad"   },
  ],
  READY:      [{ to: "DELIVERED", label: "Hand to installer", tone: "good" }],
  DELIVERED:  [],
};

export function transitionOptions(current: MakeJobStatus): readonly TransitionOption[] {
  return OPTIONS[current];
}
