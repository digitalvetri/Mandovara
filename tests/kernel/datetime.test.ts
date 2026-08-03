import { describe, expect, it } from "vitest";
import {
  ageingBucket, daysBetween, financialYear, formatDate, formatDateISO,
  formatDateTime, formatTime, fyEnd, fyStart, IST_TIMEZONE, LOCALE,
} from "@/kernel/datetime";

describe("financialYear", () => {
  it("April 1 lands in the FY starting that year", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("26-27");
  });
  it("March 31 lands in the previous FY", () => {
    expect(financialYear(new Date("2026-03-31T23:59:59+05:30"))).toBe("25-26");
  });
  it("December is in the FY that started in April of that year", () => {
    expect(financialYear(new Date("2026-12-15T12:00:00+05:30"))).toBe("26-27");
  });
});

describe("fyStart / fyEnd", () => {
  it("start of 26-27 is April 1, 2026 00:00 IST", () => {
    const start = fyStart("26-27");
    // The IST midnight of April 1 2026 = UTC 2026-03-31T18:30:00Z
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });
  it("end of 26-27 is April 1, 2027 00:00 IST (exclusive)", () => {
    const end = fyEnd("26-27");
    expect(end.toISOString()).toBe("2027-03-31T18:30:00.000Z");
  });
  it("throws on malformed label", () => {
    expect(() => fyStart("2026-2027")).toThrow(/YY-YY/);
    expect(() => fyEnd("badfy")).toThrow(/YY-YY/);
  });
});

describe("ageingBucket", () => {
  it("0 → 0-30", () => expect(ageingBucket(0)).toBe("0-30"));
  it("30 → 0-30 (inclusive)", () => expect(ageingBucket(30)).toBe("0-30"));
  it("31 → 31-60", () => expect(ageingBucket(31)).toBe("31-60"));
  it("60 → 31-60", () => expect(ageingBucket(60)).toBe("31-60"));
  it("61 → 61-90", () => expect(ageingBucket(61)).toBe("61-90"));
  it("90 → 61-90", () => expect(ageingBucket(90)).toBe("61-90"));
  it("91 → 90+", () => expect(ageingBucket(91)).toBe("90+"));
  it("negative days collapse to 0-30", () => expect(ageingBucket(-5)).toBe("0-30"));
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    const d1 = new Date("2026-01-01T00:00:00Z");
    const d2 = new Date("2026-01-04T00:00:00Z");
    expect(daysBetween(d1, d2)).toBe(3);
  });
  it("handles negative order", () => {
    const d1 = new Date("2026-01-04T00:00:00Z");
    const d2 = new Date("2026-01-01T00:00:00Z");
    expect(daysBetween(d1, d2)).toBe(-3);
  });
});

describe("formatters — smoke tests (Intl output varies subtly by ICU version)", () => {
  const d = new Date("2026-08-02T10:30:00+05:30");
  it("formatDate returns a non-empty string", () => {
    expect(formatDate(d)).toMatch(/2026/);
  });
  it("formatDateISO returns yyyy-mm-dd anchored to IST", () => {
    expect(formatDateISO(d)).toBe("2026-08-02");
    // Boundary: 10:30 IST on the 2nd was still Aug 2 in IST but Aug 2 05:00 UTC
    expect(formatDateISO(new Date("2026-08-01T22:00:00Z"))).toBe("2026-08-02");
  });
  it("formatTime returns a non-empty string with a colon", () => {
    expect(formatTime(d)).toMatch(/:/);
  });
  it("formatDateTime combines date and time", () => {
    expect(formatDateTime(d)).toContain("·");
  });
  it("constants exposed", () => {
    expect(IST_TIMEZONE).toBe("Asia/Kolkata");
    expect(LOCALE).toBe("en-IN");
  });
});
