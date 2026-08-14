// Serialized quotation types for server → client component props.
// BigInt → string, Date → ISO string (Next.js can't serialize BigInt across the RSC boundary).

export interface SerializedLine {
  id: string;
  lineNo: number;
  description: string;
  roomLabel: string | null;
  quantity: string;
  unit: string;
  rateStr: string;
  discountPct: string;
  taxableStr: string;
  gstRate: string;
  cgstStr: string;
  sgstStr: string;
  igstStr: string;
  amountStr: string;
  isOptional: boolean;
  measurementItemId: string | null;
  colourwayId: string | null;
  serviceRateId: string | null;
}

export interface SerializedQuotation {
  id: string;
  number: string;
  revision: number;
  status: string;
  branchId: string;
  branchName: string;
  supplierStateCode: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientEmail: string | null;
  clientGstin: string | null;
  projectId: string;
  projectName: string;
  date: string;
  validUntil: string;
  taxableAmountStr: string;
  cgstStr: string;
  sgstStr: string;
  igstStr: string;
  roundOffStr: string;
  totalStr: string;
  termsText: string | null;
  lines: SerializedLine[];
}
