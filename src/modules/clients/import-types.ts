// Shared row shapes for the client + project migration import.
// Kept separate so the pure parser and the pure coercion helpers can
// both reference them without importing each other.

export type ClientTypeName =
  | "HOMEOWNER" | "ARCHITECT" | "INTERIOR_DESIGNER" | "BUILDER"
  | "COMMERCIAL" | "GOVERNMENT" | "DEALER";

export interface ImportError {
  sheet:  string;
  row:    number;    // 1-based data row (spreadsheet row 2 = data row 1)
  field:  string;
  reason: string;
}

export interface ValidClientRow {
  rowNumber:   number;
  code:        string | null;   // their existing code, kept if given
  name:        string;
  mobile:      string;
  email:       string | null;
  type:        ClientTypeName;
  gstin:       string | null;
  addressLine: string | null;
  city:        string | null;
  state:       string | null;
  pincode:     string | null;
  notes:       string | null;
}

export interface ValidProjectRow {
  rowNumber:    number;
  name:         string;
  /** Matches a client by their code or their mobile — whichever they have. */
  clientRef:    string;
  stage:        string;
  siteCity:     string | null;
  siteAddress:  string | null;
  orderValuePaise: bigint;
  startedOn:    Date | null;
  notes:        string | null;
}

export interface MigrationParseResult {
  clients:  ValidClientRow[];
  projects: ValidProjectRow[];
  errors:   ImportError[];
}
