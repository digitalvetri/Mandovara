// Read-side row shapes for the measurement queries. Kept separate so
// queries.ts stays under CLAUDE.md §10's 300-line ceiling.
//
// Decimal columns arrive as strings (Prisma default toString) — the
// client formats via Intl / /lib/units at the render boundary.

export type MeasurementStatusStr = "DRAFT" | "SUBMITTED" | "APPROVED" | "SUPERSEDED";

export interface RoundListRow {
  id:              string;
  number:          string;
  revision:        number;
  visitedAt:       Date;
  status:          MeasurementStatusStr;
  measuredById:    string;
  measuredByName:  string;
  approvedByName:  string | null;
  itemCount:       number;
  roomsCovered:    string[];   // distinct room names, sorted
  notes:           string | null;
  supersedesId:    string | null;
}

export interface RoundListGroup {
  head:    RoundListRow;      // the latest revision in the chain
  history: RoundListRow[];    // older revisions, most recent first
}

export interface ItemCalcSnapshot {
  engineVersion:  string;
  materialQty:    string;
  materialUnit:   string;
  widthsRequired: number | null;
  cutLengthMm:    string | null;
  rollsRequired:  number | null;
  boxesRequired:  number | null;
  areaSqft:       string | null;
  warnings:       string[];
  computedAt:     Date;
}

export interface ItemDetail {
  id:                 string;
  roomId:             string;
  roomName:           string;
  floorLabel:         string | null;
  label:              string;
  surface:            string;
  openingType:        string | null;
  widthMm:            string;
  heightMm:           string;
  depthMm:            string | null;
  quantity:           number;
  deductions:         unknown;
  family:             string;
  headingType:        string | null;
  fullness:           string | null;
  layPattern:         string | null;
  mountType:          string | null;
  requiresPowerPoint: boolean;
  photoKeys:          string[];
  sketchKey:          string | null;
  notes:              string | null;
  calc:               ItemCalcSnapshot | null;
}

export interface RoomItemsBucket {
  roomId:     string;
  roomName:   string;
  floorLabel: string | null;
  sortOrder:  number;
  items:      ItemDetail[];
}

export interface RoundDetail {
  id:             string;
  number:         string;
  revision:       number;
  visitedAt:      Date;
  status:         MeasurementStatusStr;
  notes:          string | null;
  measuredById:   string;
  measuredByName: string;
  approvedByName: string | null;
  approvedAt:     Date | null;
  supersedesId:   string | null;
  project: {
    id:         string;
    name:       string;
    number:     string;
    clientName: string;
  };
  itemsByRoom: RoomItemsBucket[];
}
