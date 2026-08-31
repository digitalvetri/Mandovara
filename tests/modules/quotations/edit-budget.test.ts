// The owner's rule, tested as the owner stated it (2026-08-31):
// "an employee can edit three times; the fourth needs the admin to approve,
// then he can edit again" — and, asked directly, an unlock gives three more
// rather than being a one-off pass.

import { describe, it, expect } from "vitest";
import {
  checkEditBudget, budgetLabel, EDIT_BUDGET,
} from "../../../src/modules/quotations/edit-budget";

const employee = (editCount: number) => ({ editCount, canApprove: false });
const owner    = (editCount: number) => ({ editCount, canApprove: true });

describe("quotation edit budget", () => {
  it("allows the first three edits", () => {
    for (const used of [0, 1, 2]) {
      const v = checkEditBudget(employee(used));
      expect(v.allowed).toBe(true);
      expect(v.remaining).toBe(EDIT_BUDGET - used);
    }
  });

  it("blocks the fourth", () => {
    const v = checkEditBudget(employee(3));
    expect(v.allowed).toBe(false);
    expect(v.remaining).toBe(0);
    expect(v.reason).toMatch(/owner/i);
  });

  it("stays blocked beyond the fourth", () => {
    expect(checkEditBudget(employee(4)).allowed).toBe(false);
    expect(checkEditBudget(employee(99)).allowed).toBe(false);
  });

  it("never blocks someone who can approve", () => {
    for (const used of [0, 3, 50]) {
      expect(checkEditBudget(owner(used)).allowed).toBe(true);
    }
  });

  it("gives three more after an unlock — the unlock resets the count", () => {
    expect(checkEditBudget(employee(3)).allowed).toBe(false);
    // unlockQuotationEdits sets editCount back to 0
    const after = checkEditBudget(employee(0));
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(3);
  });

  it("never reports a negative remaining", () => {
    expect(checkEditBudget(employee(10)).remaining).toBe(0);
  });

  it("walks the whole sequence the owner described", () => {
    // three edits, blocked, unlocked, three more, blocked again
    const used: number[] = [];
    let count = 0;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const v = checkEditBudget(employee(count));
      if (v.allowed) { used.push(attempt); count++; }
    }
    expect(used).toEqual([1, 2, 3]);
    expect(checkEditBudget(employee(count)).allowed).toBe(false);

    count = 0; // owner unlocks
    const after: number[] = [];
    for (let attempt = 5; attempt <= 8; attempt++) {
      const v = checkEditBudget(employee(count));
      if (v.allowed) { after.push(attempt); count++; }
    }
    expect(after).toEqual([5, 6, 7]);
    expect(checkEditBudget(employee(count)).allowed).toBe(false);
  });
});

describe("budgetLabel", () => {
  it("counts down, and says so in the singular at one", () => {
    expect(budgetLabel(employee(0))).toMatch(/3 edits left/);
    expect(budgetLabel(employee(2))).toMatch(/^1 edit left/);
    expect(budgetLabel(employee(3))).toMatch(/No edits left/);
  });

  it("tells an owner they are not limited", () => {
    expect(budgetLabel(owner(3))).toMatch(/not limited/i);
  });
});
