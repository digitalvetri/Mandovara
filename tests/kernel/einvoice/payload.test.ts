import { describe, it, expect } from "vitest";
import { buildIrnPayload, paiseToRupees } from "@/kernel/einvoice/payload";
import { EInvoiceError, type EInvoiceSource } from "@/kernel/einvoice/types";

// Coimbatore, Tamil Nadu = state code 33 (§11).
function src(over: Partial<EInvoiceSource> = {}): EInvoiceSource {
  const base: EInvoiceSource = {
    number: "MDV/INV-2608-0001",
    date: new Date(Date.UTC(2026, 7, 18)),
    placeOfSupplyCode: "33",
    taxableAmount: 100_000_00n,   // ₹100,000.00
    cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n,
    roundOff: 0n,
    total: 118_000_00n,
    seller: {
      gstin: "33AABCU9603R1ZX", legalName: "Mandovara",
      address: "32 Thirumoorthy Layout", city: "Coimbatore",
      pincode: "641002", stateCode: "33",
    },
    buyer: {
      gstin: "33AABCU9603R1ZX", name: "Dr Kannan",
      address: "Saibaba Colony", city: "Coimbatore",
      pincode: "641011", stateCode: "33",
    },
    lines: [{
      description: "Sheer curtain fabric", hsn: "5407", quantity: 12, unit: "METRE",
      rate: 8_333_33n, taxable: 100_000_00n, gstRate: 18,
      cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n, amount: 118_000_00n,
    }],
  };
  return { ...base, ...over };
}

describe("paiseToRupees", () => {
  it("converts without float drift", () => {
    expect(paiseToRupees(118_000_00n)).toBe(118000);
    expect(paiseToRupees(1n)).toBe(0.01);
    expect(paiseToRupees(0n)).toBe(0);
    expect(paiseToRupees(-2_50n)).toBe(-2.5);
  });
  it("survives a crore without precision loss", () => {
    expect(paiseToRupees(1_00_00_000_00n)).toBe(10000000);
  });
});

describe("buildIrnPayload", () => {
  it("produces the NIC v1.1 shape with rupee amounts", () => {
    const p = buildIrnPayload(src()) as Record<string, Record<string, unknown>> as Record<string, Record<string, unknown>> & Record<string, Record<string, unknown>>;
    expect(p["Version"]).toBe("1.1");
    expect(p["DocDtls"]!["No"]).toBe("MDV/INV-2608-0001");
    expect(p["DocDtls"]!["Dt"]).toBe("18/08/2026");        // DD/MM/YYYY
    expect(p["ValDtls"]!["TotInvVal"]).toBe(118000);
    expect(p["ValDtls"]!["CgstVal"]).toBe(9000);
    expect(p["TranDtls"]!["SupTyp"]).toBe("B2B");
  });

  it("marks an unregistered buyer as URP / B2C", () => {
    const p = buildIrnPayload(src({ buyer: { ...src().buyer, gstin: null } })) as Record<string, Record<string, unknown>> as Record<string, Record<string, unknown>> & Record<string, Record<string, unknown>>;
    expect(p["BuyerDtls"]!["Gstin"]).toBe("URP");
    expect(p["TranDtls"]!["SupTyp"]).toBe("B2C");
  });

  it("rejects a missing seller GSTIN", () => {
    expect(() => buildIrnPayload(src({ seller: { ...src().seller, gstin: null } })))
      .toThrow(/GSTIN is not set/);
  });

  it("rejects a malformed seller GSTIN", () => {
    expect(() => buildIrnPayload(src({ seller: { ...src().seller, gstin: "NOTAGSTIN" } })))
      .toThrow(/not a valid GSTIN/);
  });

  it("rejects a malformed buyer GSTIN", () => {
    expect(() => buildIrnPayload(src({ buyer: { ...src().buyer, gstin: "123" } })))
      .toThrow(/not a valid GSTIN/);
  });

  it("rejects a document with no lines", () => {
    expect(() => buildIrnPayload(src({ lines: [] }))).toThrow(/at least one line/);
  });

  it("rejects a line with no usable HSN", () => {
    expect(() => buildIrnPayload(src({ lines: [{ ...src().lines[0]!, hsn: "12" }] })))
      .toThrow(/no valid HSN/);
  });

  it("rejects CGST/SGST on an inter-state supply", () => {
    expect(() => buildIrnPayload(src({ placeOfSupplyCode: "29" })))
      .toThrow(/must be IGST only/);
  });

  it("rejects IGST on an intra-state supply", () => {
    expect(() => buildIrnPayload(src({
      cgst: 0n, sgst: 0n, igst: 18_000_00n,
    }))).toThrow(/must be CGST\+SGST/);
  });

  it("accepts a correct inter-state supply", () => {
    const p = buildIrnPayload(src({
      placeOfSupplyCode: "29",
      cgst: 0n, sgst: 0n, igst: 18_000_00n,
      buyer: { ...src().buyer, stateCode: "29", gstin: "29AABCU9603R1ZX" },
      lines: [{ ...src().lines[0]!, cgst: 0n, sgst: 0n, igst: 18_000_00n }],
    })) as Record<string, Record<string, unknown>> as Record<string, Record<string, unknown>> & Record<string, Record<string, unknown>>;
    expect(p["ValDtls"]!["IgstVal"]).toBe(18000);
  });

  it("rejects a total that does not reconcile", () => {
    expect(() => buildIrnPayload(src({ total: 999_999_00n })))
      .toThrow(/does not equal taxable/);
  });

  it("accepts a round-off that makes the total reconcile", () => {
    const p = buildIrnPayload(src({ roundOff: -50n, total: 117_999_50n })) as Record<string, Record<string, unknown>> as Record<string, Record<string, unknown>> & Record<string, Record<string, unknown>>;
    expect(p["ValDtls"]!["RndOffAmt"]).toBe(-0.5);
  });

  it("throws EInvoiceError with a stable code", () => {
    try {
      buildIrnPayload(src({ lines: [] }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EInvoiceError);
      expect((e as EInvoiceError).code).toBe("NO_LINES");
      expect((e as EInvoiceError).retryable).toBe(false);
    }
  });
});
