import { describe, it, expect } from "vitest";
import { submitForIrn, canCancelIrn, nextRetryDelayMs, CANCEL_WINDOW_HOURS } from "@/kernel/einvoice/submit";
import { MockGspClient, isEInvoicingConfigured } from "@/kernel/einvoice/gsp";
import { EInvoiceError, type EInvoiceSource, type GspClient, type IrnResult } from "@/kernel/einvoice/types";

function src(over: Partial<EInvoiceSource> = {}): EInvoiceSource {
  return {
    number: "MDV/INV-2608-0002",
    date: new Date(Date.UTC(2026, 7, 18)),
    placeOfSupplyCode: "33",
    taxableAmount: 100_000_00n, cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n,
    roundOff: 0n, total: 118_000_00n,
    seller: { gstin: "33AABCU9603R1ZX", legalName: "Mandovara", address: "RS Puram",
              city: "Coimbatore", pincode: "641002", stateCode: "33" },
    buyer:  { gstin: null, name: "Walk-in", address: "Coimbatore",
              city: "Coimbatore", pincode: "641002", stateCode: "33" },
    lines: [{ description: "Wallpaper", hsn: "4814", quantity: 3, unit: "ROLL",
              rate: 33_333_33n, taxable: 100_000_00n, gstRate: 18,
              cgst: 9_000_00n, sgst: 9_000_00n, igst: 0n, amount: 118_000_00n }],
    ...over,
  };
}

class FailingGsp implements GspClient {
  constructor(private readonly err: EInvoiceError) {}
  async register(): Promise<IrnResult> { throw this.err; }
  async cancel(): Promise<void> { throw this.err; }
}

describe("submitForIrn", () => {
  it("is NOT_REQUIRED when no GSP is configured — billing is unaffected", async () => {
    const out = await submitForIrn(src(), new MockGspClient(), { configured: false });
    expect(out.status).toBe("NOT_REQUIRED");
    expect(out.result).toBeUndefined();
  });

  it("generates an IRN when configured", async () => {
    const out = await submitForIrn(src(), new MockGspClient(), { configured: true });
    expect(out.status).toBe("GENERATED");
    expect(out.result?.irn).toHaveLength(64);
    expect(out.result?.ackNo).toBeTruthy();
    expect(out.result?.qrCode).toBeTruthy();
  });

  it("is idempotent — the same invoice yields the same IRN", async () => {
    const gsp = new MockGspClient();
    const a = await submitForIrn(src(), gsp, { configured: true });
    const b = await submitForIrn(src(), gsp, { configured: true });
    expect(a.result?.irn).toBe(b.result?.irn);
  });

  it("stays PENDING and retryable when the GSP is DOWN", async () => {
    // §14 Phase 6: billing must keep working with the GSP down.
    const out = await submitForIrn(
      src(), new FailingGsp(new EInvoiceError("GSP_UNAVAILABLE", "503", true)),
      { configured: true },
    );
    expect(out.status).toBe("PENDING");
    expect(out.retryable).toBe(true);
  });

  it("goes to FAILED and does NOT retry when the portal rejects the document", async () => {
    const out = await submitForIrn(
      src(), new FailingGsp(new EInvoiceError("GSP_REJECTED", "bad payload", false)),
      { configured: true },
    );
    expect(out.status).toBe("FAILED");
    expect(out.retryable).toBe(false);
  });

  it("never throws on a malformed invoice — returns FAILED instead", async () => {
    const out = await submitForIrn(src({ lines: [] }), new MockGspClient(), { configured: true });
    expect(out.status).toBe("FAILED");
    expect(out.retryable).toBe(false);
    expect(out.error).toMatch(/at least one line/);
  });

  it("treats a missing seller GSTIN as permanent, not retryable", async () => {
    const out = await submitForIrn(
      src({ seller: { ...src().seller, gstin: null } }), new MockGspClient(), { configured: true },
    );
    expect(out.status).toBe("FAILED");
    expect(out.retryable).toBe(false);
  });
});

describe("canCancelIrn — the 24-hour rule", () => {
  const ack = new Date(Date.UTC(2026, 7, 18, 10, 0, 0));

  it("allows cancellation inside the window", () => {
    const now = new Date(ack.getTime() + 23 * 3_600_000);
    expect(canCancelIrn({ irnStatus: "GENERATED", ackDate: ack }, now).allowed).toBe(true);
  });

  it("allows it right at the boundary", () => {
    const now = new Date(ack.getTime() + CANCEL_WINDOW_HOURS * 3_600_000);
    expect(canCancelIrn({ irnStatus: "GENERATED", ackDate: ack }, now).allowed).toBe(true);
  });

  it("refuses past 24 hours and points at a credit note", () => {
    const now = new Date(ack.getTime() + 30 * 3_600_000);
    const c = canCancelIrn({ irnStatus: "GENERATED", ackDate: ack }, now);
    expect(c.allowed).toBe(false);
    expect(c.reason).toMatch(/credit note/i);
  });

  it("refuses a second cancellation", () => {
    const c = canCancelIrn({ irnStatus: "CANCELLED", ackDate: ack }, ack);
    expect(c.allowed).toBe(false);
    expect(c.reason).toMatch(/already been cancelled/i);
  });

  it("refuses when no IRN was ever generated", () => {
    for (const s of ["NOT_REQUIRED", "PENDING", "FAILED"] as const) {
      const c = canCancelIrn({ irnStatus: s, ackDate: null }, new Date());
      expect(c.allowed).toBe(false);
      expect(c.reason).toMatch(/no irn/i);
    }
  });

  it("refuses when the acknowledgement date is missing", () => {
    const c = canCancelIrn({ irnStatus: "GENERATED", ackDate: null }, new Date());
    expect(c.allowed).toBe(false);
    expect(c.reason).toMatch(/acknowledgement date/i);
  });
});

describe("retry backoff", () => {
  it("grows exponentially and caps at two hours", () => {
    expect(nextRetryDelayMs(1)).toBe(60_000);
    expect(nextRetryDelayMs(2)).toBe(300_000);
    expect(nextRetryDelayMs(3)).toBe(1_500_000);
    expect(nextRetryDelayMs(9)).toBe(7_200_000);
    expect(nextRetryDelayMs(0)).toBe(60_000);
  });
});

describe("configuration gate", () => {
  it("is off unless all three GSP variables are present", () => {
    const saved = { ...process.env };
    delete process.env["GSP_BASE_URL"];
    delete process.env["GSP_CLIENT_ID"];
    delete process.env["GSP_CLIENT_SECRET"];
    expect(isEInvoicingConfigured()).toBe(false);
    process.env["GSP_BASE_URL"] = "https://gsp.example";
    expect(isEInvoicingConfigured(), "partial config must not enable it").toBe(false);
    process.env["GSP_CLIENT_ID"] = "id";
    process.env["GSP_CLIENT_SECRET"] = "secret";
    expect(isEInvoicingConfigured()).toBe(true);
    process.env = saved;
  });
});

describe("MockGspClient", () => {
  it("refuses to cancel the same IRN twice", async () => {
    const gsp = new MockGspClient();
    const out = await submitForIrn(src(), gsp, { configured: true });
    await gsp.cancel(out.result!.irn, "1", "duplicate");
    await expect(gsp.cancel(out.result!.irn, "1", "duplicate")).rejects.toThrow(/already cancelled/i);
  });
});
