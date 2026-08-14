// Row shape returned by the catalog picker. Kept out of picker-actions.ts
// because that file is "use server" — a server-action file can only
// export async functions.

export interface PickerRow {
  colourwayId:  string;
  designId:     string;
  displayName:  string;
  brandName:    string;
  code:         string;
  sellUnit:     string;
  hsn:          string;
  gstRate:      number;
  family:       string;
  ratePaise:    string;
  hex:          string | null;
  imageUrl:     string | null;
}
