import { describe, it, expect, afterEach, vi } from "vitest";
import { HttpGspClient, MockGspClient, getGspClient, isEInvoicingConfigured } from "@/kernel/einvoice/gsp";
import { submitForIrn } from "@/kernel/einvoice/submit";
import { EInvoiceError, type EInvoiceSource } from "@/kernel/einvoice/types";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

function stubFetch(impl: () => Promise<Response> | never) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const client = () => new HttpGspClient("https://gsp.test", "id", "secret");

describe("HttpGspClient.register", () => {
  it("maps a successful portal response onto IrnResult", async () => {
    stubFetch(async () => json({
      Irn: "a".repeat(64), AckNo: "ACK1", AckDt: "2026-08-18T10:00:00Z",
      SignedQRCode: "qr", EwbNo: "EWB9", EwbValidTill: "2026-08-20T10:00:00Z",
    }));
    const r = await client().register({});
    expect(r.irn).toHaveLength(64);
    expect(r.ackNo).toBe("ACK1");
    expect(r.qrCode).toBe("qr");
    expect(r.ewbNumber).toBe("EWB9");
    expect(r.ewbValidUntil).toBeInstanceOf(Date);
  });

  it("tolerates a response with the optional fields absent", async () => {
    stubFetch(async () => json({}));
    const r = await client().register({});
    expect(r.irn).toBe("");
    expect(r.ackNo).toBe("");
    expect(r.qrCode).toBe("");
    expect(r.ewbNumber).toBeNull();
    expect(r.ewbValidUntil).toBeNull();
  });

  it("marks a network failure retryable", async () => {
    stubFetch(async () => { throw new Error("ECONNREFUSED"); });
    await expect(client().register({})).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("marks 5xx retryable", async () => {
    stubFetch(async () => json({}, 503));
    await expect(client().register({})).rejects.toMatchObject({ code: "GSP_UNAVAILABLE", retryable: true });
  });

  it("marks throttling (429) retryable", async () => {
    stubFetch(async () => json({}, 429));
    await expect(client().register({})).rejects.toMatchObject({ code: "GSP_UNAVAILABLE", retryable: true });
  });

  it("marks a 4xx rejection permanent — retrying resends the same bad payload", async () => {
    stubFetch(async () => new Response("duplicate IRN", { status: 400 }));
    await expect(client().register({})).rejects.toMatchObject({ code: "GSP_REJECTED", retryable: false });
  });

  it("sends the client credentials as headers", async () => {
    const spy = vi.fn(async () => json({}));
    globalThis.fetch = spy as unknown as typeof fetch;
    await client().register({ a: 1 });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-client-id"]).toBe("id");
    expect(headers["x-client-secret"]).toBe("secret");
  });
});

describe("HttpGspClient.cancel", () => {
  it("posts the IRN, reason and remark", async () => {
    const spy = vi.fn(async () => json({}));
    globalThis.fetch = spy as unknown as typeof fetch;
    await client().cancel("IRN1", "1", "keyed in error");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/Cancel");
    expect(JSON.parse(init.body as string)).toMatchObject({ Irn: "IRN1", CnlRsn: "1", CnlRem: "keyed in error" });
  });

  it("propagates a retryable outage", async () => {
    stubFetch(async () => json({}, 500));
    await expect(client().cancel("IRN1", "1", "x")).rejects.toBeInstanceOf(EInvoiceError);
  });
});

describe("MockGspClient", () => {
  it("falls back to a stable IRN when the payload carries no document number", async () => {
    // Covers the `?? "UNKNOWN"` path — a caller handing over a bare object.
    const a = await new MockGspClient().register({});
    const b = await new MockGspClient().register({ DocDtls: {} });
    expect(a.irn).toHaveLength(64);
    expect(a.irn).toBe(b.irn);
  });
});

describe("getGspClient", () => {
  it("returns the mock when unconfigured, and the HTTP client when configured", () => {
    const saved = { ...process.env };
    delete process.env["GSP_BASE_URL"];
    delete process.env["GSP_CLIENT_ID"];
    delete process.env["GSP_CLIENT_SECRET"];
    expect(getGspClient()).toBeInstanceOf(MockGspClient);

    process.env["GSP_BASE_URL"] = "https://gsp.test";
    process.env["GSP_CLIENT_ID"] = "id";
    process.env["GSP_CLIENT_SECRET"] = "secret";
    expect(getGspClient()).toBeInstanceOf(HttpGspClient);
    process.env = saved;
  });
});

describe("submitForIrn default configuration branch", () => {
  it("reads isEInvoicingConfigured() when opts.configured is omitted", async () => {
    const saved = { ...process.env };
    delete process.env["GSP_BASE_URL"];
    expect(isEInvoicingConfigured()).toBe(false);
    const src = {} as EInvoiceSource;   // never inspected on the NOT_REQUIRED path
    const out = await submitForIrn(src, new MockGspClient());
    expect(out.status).toBe("NOT_REQUIRED");
    process.env = saved;
  });
});
