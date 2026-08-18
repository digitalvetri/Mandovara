// GSP transport. One interface, two implementations.
//
// No GSP account exists yet and §1.6 lists e-invoice applicability as an open
// question, so the default is a mock. Pointing at a real GSP is configuration
// (GSP_BASE_URL / GSP_CLIENT_ID / GSP_CLIENT_SECRET), not a code change.

import { EInvoiceError, type GspClient, type IrnResult } from "./types";

/** True only when a real GSP is configured. §14 Phase 6: billing must work
 *  with the GSP down, so every caller checks this first. */
export function isEInvoicingConfigured(): boolean {
  return Boolean(
    process.env["GSP_BASE_URL"] &&
    process.env["GSP_CLIENT_ID"] &&
    process.env["GSP_CLIENT_SECRET"],
  );
}

/** Deterministic stand-in used in dev and tests. Never touches the network. */
export class MockGspClient implements GspClient {
  private readonly cancelled = new Set<string>();

  async register(payload: Record<string, unknown>): Promise<IrnResult> {
    const doc = payload["DocDtls"] as { No?: string } | undefined;
    const no  = doc?.No ?? "UNKNOWN";
    // A 64-char hex IRN, like the portal's, derived from the document number
    // so the same invoice always yields the same IRN — which is exactly the
    // portal's own idempotency behaviour.
    const irn = Array.from(no).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
      .toString(16).padStart(8, "0").repeat(8).slice(0, 64);
    return {
      irn,
      ackNo:   `ACK${irn.slice(0, 10).toUpperCase()}`,
      ackDate: new Date(),
      qrCode:  `data:text/plain;base64,${Buffer.from(irn).toString("base64")}`,
    };
  }

  async cancel(irn: string, _reason?: string, _remark?: string): Promise<void> {
    if (this.cancelled.has(irn)) {
      throw new EInvoiceError("ALREADY_CANCELLED", `IRN ${irn} is already cancelled.`);
    }
    this.cancelled.add(irn);
  }
}

/** Real GSP over HTTPS. Kept deliberately thin — auth//payload quirks differ
 *  per provider and belong behind this boundary, not in the domain. */
export class HttpGspClient implements GspClient {
  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async call(path: string, body: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-id": this.clientId,
          "x-client-secret": this.clientSecret,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Network failure is always worth retrying.
      throw new EInvoiceError("NETWORK", `GSP unreachable: ${(e as Error).message}`, true);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new EInvoiceError("GSP_UNAVAILABLE", `GSP returned ${res.status}`, true);
    }
    if (!res.ok) {
      // 4xx is a rejected document — retrying sends the same bad payload.
      throw new EInvoiceError("GSP_REJECTED", `GSP returned ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  async register(payload: Record<string, unknown>): Promise<IrnResult> {
    const r = (await this.call("/eicore/v1.03/Invoice", payload)) as Record<string, string>;
    return {
      irn:     r["Irn"] ?? "",
      ackNo:   r["AckNo"] ?? "",
      ackDate: r["AckDt"] ? new Date(r["AckDt"]) : new Date(),
      qrCode:  r["SignedQRCode"] ?? "",
      ewbNumber: r["EwbNo"] ?? null,
      ewbValidUntil: r["EwbValidTill"] ? new Date(r["EwbValidTill"]) : null,
    };
  }

  async cancel(irn: string, reason: string, remark: string): Promise<void> {
    await this.call("/eicore/v1.03/Invoice/Cancel", { Irn: irn, CnlRsn: reason, CnlRem: remark });
  }
}

export function getGspClient(): GspClient {
  if (!isEInvoicingConfigured()) return new MockGspClient();
  return new HttpGspClient(
    process.env["GSP_BASE_URL"]!,
    process.env["GSP_CLIENT_ID"]!,
    process.env["GSP_CLIENT_SECRET"]!,
  );
}
