// Types shared by the field PWA components. Kept out of the main
// component files so each stays under CLAUDE.md §10 300 lines.

import type { PRODUCT_FAMILIES, SURFACE_TYPES, HEADING_TYPES, LAY_PATTERNS, MOUNT_TYPES } from "@/modules/measurement/schema";

export type Family     = (typeof PRODUCT_FAMILIES)[number];
export type Surface    = (typeof SURFACE_TYPES)[number];
export type Heading    = (typeof HEADING_TYPES)[number];
export type Lay        = (typeof LAY_PATTERNS)[number];
export type MountKind  = (typeof MOUNT_TYPES)[number];
export type Unit       = "mm" | "in" | "ft";

// What the field PWA is measuring. A project, or — since 2026-08-27 —
// a lead that hasn't converted yet. Same four fields either way, so
// nothing below this type has to care which it got.
export interface FieldSubject {
  kind:       "PROJECT" | "LEAD";
  id:         string;
  number:     string;
  name:       string;
  /** Client name for a project; for a lead, that there isn't one yet. */
  clientName: string;
}

export interface FieldRoom {
  id:         string;
  name:       string;
  floorLabel: string | null;
  sortOrder:  number;
}

export interface ResumableRound {
  id:        string;
  number:    string;
  visitedAt: Date;
  itemCount: number;
}

// The client-side item draft. Values are strings so the input fields
// can accept partial input during typing; conversion happens at
// enqueue time via toEnqueuePayload().
export interface ItemDraft {
  clientCuid:  string;
  roomId:      string;
  label:       string;
  surface:     Surface;
  family:      Family;
  widthMm:     string;
  heightMm:    string;
  quantity:    string;
  // family extras
  headingType?: Heading;
  fullness?:    string;
  layPattern?:  Lay;
  mountType?:   MountKind;
  // evidence
  photoKey?:   string;   // signed URL once uploaded; empty until then
  sketchKey?:  string;
  notes?:      string;
}

export type FlowStep =
  | "room"
  | "label"
  | "surface"
  | "family"
  | "dims"
  | "extras"
  | "photo"
  | "sketch"
  | "review";
