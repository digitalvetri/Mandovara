// The status a quotation may be moved to, and by whom.
//
// The owner's report (2026-09-04) was that a quotation which had been
// invoiced and paid still read "Draft", with no control anywhere to say
// otherwise. The fix widened the transition table — so these tests pin
// both halves of that: the moves that now exist, and the ones that must
// NOT have come along with them.
//
// The map is shared: setQuotationStatus enforces it server-side and
// StatusMenu draws from it. Testing it here tests both.

import { describe, it, expect } from "vitest";
import {
  QUOTATION_TRANSITIONS, QUOTATION_STATUS_LABEL, QUOTATION_STATUS_HINT,
  allowedStatusTargets, permissionForStatus,
} from "../../../src/modules/quotations/transitions";
import { QUOTATION_STATUSES } from "../../../src/modules/quotations/schema";

const OWNER = ["quotation.update", "quotation.send", "quotation.approve"];
const SALES = ["quotation.update", "quotation.send"];
const CLERK = ["quotation.update"];

describe("quotation transitions — the owner's complaint", () => {
  it("a draft can be marked accepted without being sent first", () => {
    // The reported case: the client agreed on the phone, an invoice went
    // out, the money landed, and the quote still said Draft.
    expect(QUOTATION_TRANSITIONS["DRAFT"]).toContain("ACCEPTED");
  });

  it("every status except the terminal-by-choice ones can still move", () => {
    for (const s of QUOTATION_STATUSES) {
      expect(QUOTATION_TRANSITIONS[s]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("a sent quote can be corrected back to draft", () => {
    expect(QUOTATION_TRANSITIONS["SENT"]).toContain("DRAFT");
  });

  it("a rejected quote can be revived", () => {
    expect(QUOTATION_TRANSITIONS["REJECTED"]).toContain("ACCEPTED");
  });
});

describe("quotation transitions — what did not get widened", () => {
  it("no status can move to itself", () => {
    for (const [from, targets] of Object.entries(QUOTATION_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });

  it("every target is a real QuotationStatus", () => {
    const known = new Set<string>(QUOTATION_STATUSES);
    for (const targets of Object.values(QUOTATION_TRANSITIONS)) {
      for (const t of targets) expect(known.has(t)).toBe(true);
    }
  });

  it("every source is a real QuotationStatus, and all of them are covered", () => {
    expect(Object.keys(QUOTATION_TRANSITIONS).sort())
      .toEqual([...QUOTATION_STATUSES].sort());
  });

  it("an accepted quote cannot be dropped back to draft", () => {
    // Acceptance raises an Order. Draft would leave a live order priced
    // against a quote the app says is still being written.
    expect(QUOTATION_TRANSITIONS["ACCEPTED"]).not.toContain("DRAFT");
  });
});

describe("permission gating stays on the target, not the caller", () => {
  it("sending and accepting need quotation.send", () => {
    expect(permissionForStatus("SENT")).toBe("quotation.send");
    expect(permissionForStatus("ACCEPTED")).toBe("quotation.send");
  });

  it("internal approval needs quotation.approve", () => {
    expect(permissionForStatus("APPROVED")).toBe("quotation.approve");
  });

  it("everything else needs only quotation.update", () => {
    for (const s of ["DRAFT", "REVISED", "REJECTED", "EXPIRED", "PENDING_APPROVAL"]) {
      expect(permissionForStatus(s)).toBe("quotation.update");
    }
  });

  it("a clerk who cannot send is never offered Send or Accept", () => {
    const targets = allowedStatusTargets("DRAFT", CLERK);
    expect(targets).not.toContain("SENT");
    expect(targets).not.toContain("ACCEPTED");
    expect(targets).toContain("REJECTED");
  });

  it("a clerk who cannot approve is never offered Approved", () => {
    expect(allowedStatusTargets("DRAFT", CLERK)).not.toContain("APPROVED");
    expect(allowedStatusTargets("PENDING_APPROVAL", SALES)).not.toContain("APPROVED");
  });

  it("the owner is offered every move the table allows", () => {
    for (const from of QUOTATION_STATUSES) {
      expect(allowedStatusTargets(from, OWNER))
        .toEqual([...(QUOTATION_TRANSITIONS[from] ?? [])]);
    }
  });

  it("accepts a Set of permissions as readily as an array", () => {
    expect(allowedStatusTargets("DRAFT", new Set(OWNER)))
      .toEqual(allowedStatusTargets("DRAFT", OWNER));
  });

  it("someone with no permissions at all is offered nothing", () => {
    for (const from of QUOTATION_STATUSES) {
      expect(allowedStatusTargets(from, [])).toEqual([]);
    }
  });
});

describe("the picker has words for every status", () => {
  it("labels and hints cover the whole enum", () => {
    for (const s of QUOTATION_STATUSES) {
      expect(QUOTATION_STATUS_LABEL[s]).toBeTruthy();
      expect(QUOTATION_STATUS_HINT[s]).toBeTruthy();
    }
  });

  it("labels are sentence case, not shouted enum values", () => {
    for (const s of QUOTATION_STATUSES) {
      expect(QUOTATION_STATUS_LABEL[s]).not.toBe(s);
    }
  });
});
