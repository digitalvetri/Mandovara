// The migration import is how ten years of Mandovara's books arrive.
// These are the shapes real Indian business spreadsheets actually hold —
// each case here is a way the data would have been silently corrupted.

import { describe, it, expect } from "vitest";
import {
  normaliseMobile, parseRupeesToPaise, parseDate, norm, pick, str,
  TYPE_ALIASES, STAGE_ALIASES,
} from "@/modules/clients/import-coerce";

describe("normaliseMobile", () => {
  // The mobile is the identity this system matches clients by. Get it
  // wrong and you either merge two customers or split one in half.
  it("accepts the ways a 10-digit number gets typed", () => {
    for (const v of ["9843012345", "98430 12345", "98430-12345", " 9843012345 "]) {
      expect(normaliseMobile(v)).toBe("+919843012345");
    }
  });

  it("accepts country code with and without punctuation", () => {
    for (const v of ["+919843012345", "+91 98430 12345", "919843012345", "+91-9843012345"]) {
      expect(normaliseMobile(v)).toBe("+919843012345");
    }
  });

  it("strips the leading zero Indian books often carry", () => {
    expect(normaliseMobile("09843012345")).toBe("+919843012345");
  });

  it("recovers a number Excel turned into scientific notation", () => {
    // A 10-digit number in a General-formatted cell becomes 9.843012345e9.
    // Without this the whole row is rejected and a real client is lost.
    expect(normaliseMobile("9.843012345e9")).toBe("+919843012345");
    expect(normaliseMobile(9843012345)).toBe("+919843012345");
  });

  it("rejects what is not a mobile rather than guessing", () => {
    for (const v of ["", null, undefined, "N/A", "12345", "0422 2345678", "notanumber"]) {
      expect(normaliseMobile(v)).toBeNull();
    }
  });
});

describe("parseRupeesToPaise", () => {
  // Money is BigInt paise everywhere (CLAUDE.md §0.4). A float here
  // would round somebody's order value on the way in.
  it("reads plain numbers as rupees", () => {
    expect(parseRupeesToPaise(150000)).toBe(15_000_000n);
    expect(parseRupeesToPaise("150000")).toBe(15_000_000n);
  });

  it("reads Indian digit grouping and the rupee sign", () => {
    expect(parseRupeesToPaise("1,50,000")).toBe(15_000_000n);
    expect(parseRupeesToPaise("₹1,50,000")).toBe(15_000_000n);
    expect(parseRupeesToPaise("₹ 1,50,000.50")).toBe(15_000_050n);
  });

  it("reads lakh and crore shorthand, which hand-kept books use", () => {
    expect(parseRupeesToPaise("1.5L")).toBe(15_000_000n);
    expect(parseRupeesToPaise("2 lakh")).toBe(20_000_000n);
    expect(parseRupeesToPaise("1cr")).toBe(1_000_000_000n);
  });

  it("returns null for blanks rather than zero", () => {
    // Zero and "they didn't record it" are different facts; the caller
    // decides what a blank means, and this must not decide for it.
    for (const v of ["", "  ", null, undefined]) {
      expect(parseRupeesToPaise(v)).toBeNull();
    }
  });

  it("keeps full precision on a large value", () => {
    expect(parseRupeesToPaise("1,23,45,678.90")).toBe(1_234_567_890n);
  });
});

describe("parseDate", () => {
  it("reads dd/mm/yyyy as Indian books mean it", () => {
    // 03/04/2026 is 3 April here, not 4 March. Reading it American
    // would silently move a job by a month.
    const d = parseDate("03/04/2026");
    expect(d?.getUTCDate()).toBe(3);
    expect(d?.getUTCMonth()).toBe(3);   // April
    expect(d?.getUTCFullYear()).toBe(2026);
  });

  it("reads two-digit years", () => {
    expect(parseDate("03/04/26")?.getUTCFullYear()).toBe(2026);
  });

  it("reads an Excel serial date", () => {
    // 45000 ≈ 2023-03-15. Excel-typed date cells arrive as numbers.
    const d = parseDate(45_000);
    expect(d?.getUTCFullYear()).toBe(2023);
  });

  it("passes through a real Date", () => {
    const src = new Date(Date.UTC(2026, 0, 15));
    expect(parseDate(src)?.getTime()).toBe(src.getTime());
  });

  it("returns null for blanks and nonsense", () => {
    for (const v of ["", null, undefined, "not a date"]) {
      expect(parseDate(v)).toBeNull();
    }
  });
});

describe("header normalisation", () => {
  it("matches however the export capitalised and spaced the header", () => {
    expect(norm("Client Name")).toBe("client_name");
    expect(norm("  CLIENT-NAME ")).toBe("client_name");
    expect(norm("client_name")).toBe("client_name");
  });

  it("picks the first column that actually holds something", () => {
    const row = { name: "", client_name: "Dr Kannan", customer_name: "ignored" };
    expect(pick(row, "name", "client_name", "customer_name")).toBe("Dr Kannan");
  });

  it("treats whitespace-only cells as empty", () => {
    expect(str("   ")).toBeNull();
    expect(str("Dr Kannan")).toBe("Dr Kannan");
  });
});

describe("vocabulary mapping", () => {
  // Their books will not use our enum names. Rejecting a row because it
  // said "Contractor" instead of "BUILDER" would fail the migration for
  // no reason a person would accept.
  it("maps the words a person would actually type for client type", () => {
    expect(TYPE_ALIASES["contractor"]).toBe("BUILDER");
    expect(TYPE_ALIASES["designer"]).toBe("INTERIOR_DESIGNER");
    expect(TYPE_ALIASES["individual"]).toBe("HOMEOWNER");
    expect(TYPE_ALIASES["architect"]).toBe("ARCHITECT");
  });

  it("maps the ways a finished job gets described", () => {
    for (const w of ["completed", "done", "delivered", "installed", "closed"]) {
      expect(STAGE_ALIASES[w]).toBe("COMPLETED");
    }
    expect(STAGE_ALIASES["quoted"]).toBe("QUOTATION");
    expect(STAGE_ALIASES["lost"]).toBe("CANCELLED");
  });
});
