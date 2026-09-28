// Notes on a quotation (Transportation extra, delivery period, …) and the
// studio's bank details printed beneath them — owner request 2026-09-28.

import { describe, it, expect } from "vitest";
import {
  NARRATION_PRESETS, narrationsInput, readNarrations, toStoredNarrations, narrationLine, narrationsForSave,
} from "../../../src/modules/quotations/narrations";
import {
  bankDetailsInput, readBankDetails, hasBankDetails, branchAndIfsc, EMPTY_BANK_DETAILS,
} from "../../../src/modules/admin/bank-details";

describe("quotation narrations", () => {
  it("offers transportation and delivery period as presets", () => {
    const keys = NARRATION_PRESETS.map((p) => p.key);
    expect(keys).toContain("transport");
    expect(keys).toContain("delivery");
    for (const p of NARRATION_PRESETS) expect(p.defaultText.length).toBeGreaterThan(0);
  });

  it("accepts ticked notes with text", () => {
    const r = narrationsInput.safeParse([
      { key: "transport", label: "Transportation", text: "Transportation charges extra" },
      { key: "note-1", label: "", text: "Scaffolding by client" },
    ]);
    expect(r.success).toBe(true);
  });

  it("rejects a ticked note left blank", () => {
    const r = narrationsInput.safeParse([{ key: "delivery", label: "Delivery period", text: "   " }]);
    expect(r.success).toBe(false);
  });

  it("rejects the same note twice", () => {
    const n = { key: "transport", label: "Transportation", text: "Extra" };
    expect(narrationsInput.safeParse([n, n]).success).toBe(false);
  });

  it("reads back only well-formed entries, first of each key", () => {
    const got = readNarrations([
      { key: "transport", label: "Transportation", text: "Extra" },
      { key: "transport", label: "Transportation", text: "Duplicate" },
      { key: "delivery", label: "Delivery period" },
      "garbage",
      null,
    ]);
    expect(got).toEqual([{ key: "transport", label: "Transportation", text: "Extra" }]);
  });

  it("reads a missing or non-array column as no notes", () => {
    expect(readNarrations(null)).toEqual([]);
    expect(readNarrations({ key: "x" })).toEqual([]);
  });

  it("stores no notes as an empty list", () => {
    expect(toStoredNarrations([])).toEqual([]);
    expect(toStoredNarrations(undefined)).toEqual([]);
    expect(toStoredNarrations([{ key: "note-1", label: "", text: "  " }])).toEqual([]);
  });

  it("reads an empty stored list as no notes", () => {
    expect(readNarrations([])).toEqual([]);
  });

  it("keeps the order the notes were ticked in", () => {
    const stored = toStoredNarrations([
      { key: "delivery", label: "Delivery period", text: " 2 weeks " },
      { key: "transport", label: "Transportation", text: "Extra" },
    ]);
    expect(stored.map((n) => n.key)).toEqual(["delivery", "transport"]);
    expect(stored[0]?.text).toBe("2 weeks");
  });

  it("does not send a note the user left blank", () => {
    expect(narrationsForSave([
      { key: "transport", label: "Transportation", text: "  " },
      { key: "note-1", label: "", text: " Scaffolding by client " },
    ])).toEqual([{ key: "note-1", label: "", text: "Scaffolding by client" }]);
  });

  it("prints the label before the text when there is one", () => {
    expect(narrationLine({ key: "delivery", label: "Delivery period", text: "2 weeks" }))
      .toBe("Delivery period: 2 weeks");
    expect(narrationLine({ key: "note-1", label: "", text: "Rates valid for this site only" }))
      .toBe("Rates valid for this site only");
  });
});

describe("company bank details", () => {
  const pnb = {
    bankName: "PUNJAB NATIONAL BANK (OD)", accountName: "",
    accountNumber: "009800GT00000013", branch: "COIMBATORE MAIN", ifsc: "punb0009800",
  };

  it("accepts the studio's account and upper-cases the IFSC", () => {
    const r = bankDetailsInput.safeParse(pnb);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ifsc).toBe("PUNB0009800");
  });

  it("rejects a malformed IFSC", () => {
    expect(bankDetailsInput.safeParse({ ...pnb, ifsc: "PUNB9800" }).success).toBe(false);
  });

  it("needs both the bank name and the account number", () => {
    expect(bankDetailsInput.safeParse({ ...pnb, accountNumber: "" }).success).toBe(false);
    expect(bankDetailsInput.safeParse({ ...pnb, bankName: "" }).success).toBe(false);
  });

  it("allows clearing everything", () => {
    expect(bankDetailsInput.safeParse(EMPTY_BANK_DETAILS).success).toBe(true);
  });

  it("only prints when there is an account to pay into", () => {
    expect(hasBankDetails(readBankDetails(null))).toBe(false);
    expect(hasBankDetails(readBankDetails(pnb))).toBe(true);
  });

  it("prints branch and IFSC the way the paper quotations do", () => {
    expect(branchAndIfsc(readBankDetails(pnb))).toBe("COIMBATORE MAIN & PUNB0009800");
    expect(branchAndIfsc(readBankDetails({ ...pnb, branch: "" }))).toBe("PUNB0009800");
  });
});
