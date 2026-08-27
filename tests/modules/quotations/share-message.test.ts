// The client-facing share message is the only text in the system a
// client reads before deciding to spend money, and two surfaces render
// it (the quotation header and the lead page). These tests pin the
// things that would silently break if either surface drifted.

import { describe, it, expect } from "vitest";
import {
  buildShareMessage, shareLink, pToINR, shortNum, digitsOnly,
} from "@/modules/quotations/share-message";

const BASE = {
  quotationId:     "qt_abc123",
  quotationNumber: "MDV/QT-2608-0142",
  clientName:      "Dr Kannan",
  totalStr:        "16500000",          // ₹1,65,000 in paise
  validUntilIso:   "2026-09-26T00:00:00.000Z",
  shareToken:      "a".repeat(64),
};

describe("pToINR", () => {
  it("groups in the Indian system, not thousands", () => {
    expect(pToINR("16500000")).toBe("₹1,65,000");
    expect(pToINR("100000000")).toBe("₹10,00,000");
  });
  it("leaves sub-thousand amounts ungrouped", () => {
    expect(pToINR("99900")).toBe("₹999");
  });
  it("survives garbage rather than throwing at a client", () => {
    expect(pToINR("not-a-number")).toBe("₹0");
  });
});

describe("shortNum", () => {
  it("keeps the human-readable tail of a series number", () => {
    expect(shortNum("MDV/QT-2608-0142")).toBe("QT-2608-0142");
  });
  it("passes through a number with no prefix", () => {
    expect(shortNum("QT-0142")).toBe("QT-0142");
  });
});

describe("digitsOnly", () => {
  it("strips +, spaces and dashes so wa.me accepts the number", () => {
    expect(digitsOnly("+91 89404 30051")).toBe("918940430051");
  });
});

describe("shareLink", () => {
  it("prefers the public token route", () => {
    expect(shareLink("qt_1", "tok", "https://app.mandovara.com"))
      .toBe("https://app.mandovara.com/q/tok");
  });

  // Regression guard: a quotation with no token used to fall back to
  // /quotations/[id], an authenticated route the client cannot open.
  // Both send surfaces now mint a token first (share-token.ts); this
  // asserts the fallback is still visibly distinct so it can't be
  // mistaken for a working client link.
  it("falls back to the internal route when no token was minted", () => {
    expect(shareLink("qt_1", null, "https://app.mandovara.com"))
      .toBe("https://app.mandovara.com/quotations/qt_1");
  });

  it("stays relative when no origin is known (server render)", () => {
    expect(shareLink("qt_1", "tok")).toBe("/q/tok");
  });
});

describe("buildShareMessage", () => {
  const msg = buildShareMessage({ ...BASE, origin: "https://app.mandovara.com" });

  it("addresses the client by name and names the quotation", () => {
    expect(msg.body).toContain("Namaste Dr Kannan");
    expect(msg.body).toContain("QT-2608-0142");
  });

  it("states the total in Indian grouping and the validity date in IST", () => {
    expect(msg.body).toContain("₹1,65,000");
    // en-IN abbreviates September as "Sept", not "Sep" — asserted verbatim
    // so a locale/ICU change that reformats client-facing dates is caught.
    expect(msg.body).toContain("26 Sept 2026");
  });

  it("carries the share link the client will actually open", () => {
    expect(msg.body).toContain("https://app.mandovara.com/q/" + "a".repeat(64));
  });

  it("leads with the PDF, because that is the document the client wants", () => {
    // Owner instruction 2026-08-27: the client should receive a PDF, not
    // a link to a page. wa.me cannot attach a file, so the next best
    // thing is a URL that resolves straight to application/pdf.
    const pdfUrl = `https://app.mandovara.com/q/${"a".repeat(64)}/pdf`;
    expect(msg.pdf).toBe(pdfUrl);
    // The PDF line comes before the accept line in the message body.
    expect(msg.body.indexOf(pdfUrl)).toBeLessThan(msg.body.indexOf("To accept it"));
  });

  it("still offers the accept page as a clearly-labelled second link", () => {
    expect(msg.body).toContain("To accept it or ask for changes:");
    expect(msg.body).toContain(msg.link);
  });

  it("falls back to the page alone when no token has been minted", () => {
    // Never print a dead PDF line — /q/null/pdf would 404 at the client.
    const noToken = buildShareMessage({ ...BASE, shareToken: null, origin: "https://app.mandovara.com" });
    expect(noToken.pdf).toBeNull();
    expect(noToken.body).not.toContain("/pdf");
    expect(noToken.body).toContain("accept it or request changes");
  });

  it("URL-encodes the body into the wa.me deep link", () => {
    const href = msg.waHref("+91 89404 30051");
    expect(href.startsWith("https://wa.me/918940430051?text=")).toBe(true);
    expect(decodeURIComponent(href.split("?text=")[1] ?? "")).toBe(msg.body);
  });

  it("returns null for mailto when the client has no email on file", () => {
    expect(msg.mailHref(null)).toBeNull();
    expect(msg.mailHref("a@b.com")).toContain("mailto:a%40b.com");
  });

  it("renders identically from either surface given the same inputs", () => {
    const fromLeadPage = buildShareMessage({ ...BASE, origin: "https://app.mandovara.com" });
    expect(fromLeadPage.body).toBe(msg.body);
    expect(fromLeadPage.subject).toBe(msg.subject);
  });
});
