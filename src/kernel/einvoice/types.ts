// e-Invoice (IRN) types — §14 Phase 6, §13 GSP_* env.
//
// Applicability: e-invoicing is mandatory only above the AATO threshold
// (₹5 crore at time of writing). CLAUDE.md §1.6 lists confirming this as an
// open item, so the whole subsystem is OFF unless configured — an unconfigured
// deployment leaves every invoice at NOT_REQUIRED and billing is unaffected.

/** The subset of an Invoice the IRN payload needs. Money is paise. */
export interface EInvoiceSource {
  number:            string;
  date:              Date;
  placeOfSupplyCode: string;
  taxableAmount:     bigint;
  cgst:              bigint;
  sgst:              bigint;
  igst:              bigint;
  roundOff:          bigint;
  total:             bigint;
  seller: {
    gstin?: string | null;
    legalName: string;
    address: string;
    city: string;
    pincode: string;
    stateCode: string;
  };
  buyer: {
    gstin?: string | null;
    name: string;
    address: string;
    city: string;
    pincode: string;
    stateCode: string;
  };
  lines: EInvoiceLine[];
}

export interface EInvoiceLine {
  description: string;
  hsn:         string;
  quantity:    number;
  unit:        string;
  rate:        bigint;   // paise
  taxable:     bigint;
  gstRate:     number;
  cgst:        bigint;
  sgst:        bigint;
  igst:        bigint;
  amount:      bigint;
}

/** What the GSP returns on a successful registration. */
export interface IrnResult {
  irn:     string;
  ackNo:   string;
  ackDate: Date;
  qrCode:  string;
  ewbNumber?:     string | null;
  ewbValidUntil?: Date | null;
}

export class EInvoiceError extends Error {
  /** true when retrying could plausibly succeed (network, 5xx, throttling). */
  readonly retryable: boolean;
  readonly code: string;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "EInvoiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

/** The seam a real GSP implementation plugs into. */
export interface GspClient {
  register(payload: Record<string, unknown>): Promise<IrnResult>;
  cancel(irn: string, reason: string, remark: string): Promise<void>;
}
