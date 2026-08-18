// Builds the NIC e-invoice (IRN) JSON from an Invoice.
//
// Pure and fully tested — no I/O, no GSP. The schema below follows NIC
// e-Invoice API v1.1 field names, which are what every GSP proxies.
//
// Money: the portal wants RUPEES as numbers with 2 decimals, but everything
// upstream in this codebase is BigInt paise (§0.4). The conversion happens
// here, once, and nowhere else.

import type { EInvoiceSource } from "./types";
import { EInvoiceError } from "./types";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** paise → rupees, rounded half-up to 2dp, as the portal expects. */
export function paiseToRupees(p: bigint): number {
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const rupees = Number(abs / 100n) + Number(abs % 100n) / 100;
  return neg ? -rupees : rupees;
}

function ymd(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;   // NIC wants DD/MM/YYYY
}

export function buildIrnPayload(src: EInvoiceSource): Record<string, unknown> {
  // ── Validation. The portal rejects the whole document for any of these, so
  //    failing here with a precise message beats a generic GSP error later.
  if (!src.seller.gstin) {
    throw new EInvoiceError("SELLER_GSTIN_MISSING",
      "Organisation GSTIN is not set — e-invoicing cannot be used without it.");
  }
  if (!GSTIN_RE.test(src.seller.gstin)) {
    throw new EInvoiceError("SELLER_GSTIN_INVALID",
      `Organisation GSTIN "${src.seller.gstin}" is not a valid GSTIN.`);
  }
  if (src.buyer.gstin && !GSTIN_RE.test(src.buyer.gstin)) {
    throw new EInvoiceError("BUYER_GSTIN_INVALID",
      `Client GSTIN "${src.buyer.gstin}" is not a valid GSTIN.`);
  }
  if (src.lines.length === 0) {
    throw new EInvoiceError("NO_LINES", "An e-invoice must have at least one line.");
  }
  for (const l of src.lines) {
    if (!l.hsn || l.hsn.length < 4) {
      throw new EInvoiceError("HSN_MISSING",
        `Line "${l.description}" has no valid HSN — the portal requires at least 4 digits.`);
    }
  }
  // Intra-state must be CGST+SGST, inter-state IGST — never both (§4).
  const interState = src.seller.stateCode !== src.placeOfSupplyCode;
  if (interState && (src.cgst > 0n || src.sgst > 0n)) {
    throw new EInvoiceError("TAX_SPLIT_MISMATCH",
      "Inter-state supply carries CGST/SGST — it must be IGST only.");
  }
  if (!interState && src.igst > 0n) {
    throw new EInvoiceError("TAX_SPLIT_MISMATCH",
      "Intra-state supply carries IGST — it must be CGST+SGST.");
  }
  // The portal recomputes the total and rejects a mismatch beyond ±1 rupee.
  const computed = src.taxableAmount + src.cgst + src.sgst + src.igst + src.roundOff;
  if (computed !== src.total) {
    throw new EInvoiceError("TOTAL_MISMATCH",
      `Invoice total ${src.total} does not equal taxable + tax + round-off (${computed}).`);
  }

  return {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: src.buyer.gstin ? "B2B" : "B2C",
      RegRev: "N",
      IgstOnIntra: "N",
    },
    DocDtls: { Typ: "INV", No: src.number, Dt: ymd(src.date) },
    SellerDtls: {
      Gstin: src.seller.gstin,
      LglNm: src.seller.legalName,
      Addr1: src.seller.address,
      Loc:   src.seller.city,
      Pin:   Number(src.seller.pincode),
      Stcd:  src.seller.stateCode,
    },
    BuyerDtls: {
      // URP = unregistered person; the portal's own sentinel for B2C.
      Gstin: src.buyer.gstin ?? "URP",
      LglNm: src.buyer.name,
      Pos:   src.placeOfSupplyCode,
      Addr1: src.buyer.address,
      Loc:   src.buyer.city,
      Pin:   Number(src.buyer.pincode),
      Stcd:  src.buyer.stateCode,
    },
    ItemList: src.lines.map((l, i) => ({
      SlNo:        String(i + 1),
      PrdDesc:     l.description.slice(0, 300),
      IsServc:     "N",
      HsnCd:       l.hsn,
      Qty:         l.quantity,
      Unit:        l.unit,
      UnitPrice:   paiseToRupees(l.rate),
      TotAmt:      paiseToRupees(l.taxable),
      AssAmt:      paiseToRupees(l.taxable),
      GstRt:       l.gstRate,
      CgstAmt:     paiseToRupees(l.cgst),
      SgstAmt:     paiseToRupees(l.sgst),
      IgstAmt:     paiseToRupees(l.igst),
      TotItemVal:  paiseToRupees(l.amount),
    })),
    ValDtls: {
      AssVal:   paiseToRupees(src.taxableAmount),
      CgstVal:  paiseToRupees(src.cgst),
      SgstVal:  paiseToRupees(src.sgst),
      IgstVal:  paiseToRupees(src.igst),
      RndOffAmt: paiseToRupees(src.roundOff),
      TotInvVal: paiseToRupees(src.total),
    },
  };
}
