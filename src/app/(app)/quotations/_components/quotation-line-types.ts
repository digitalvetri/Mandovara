// Shared line-row shape used by QuotationBuilder + LineRow. Kept in a
// plain .ts (no "use client") so both files can import it without
// tripping the RSC boundary.

export interface LineInput {
  description:       string;
  quantity:          string;
  unit:              string;
  rate:              string;
  gstRate:           string;
  discountPct:       string;
  roomLabel:         string;
  measurementItemId: string;
  colourwayId?:      string;   // sent server-side (Task 5 uses this for stock reservation)
  productLabel?:     string;   // "DESIGN — Colour (CODE)" for the row pill
  family?:           string;   // restricts the picker to matching designs
}
