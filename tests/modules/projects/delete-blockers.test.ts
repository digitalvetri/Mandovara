// The sentence a blocked project delete shows. It is the only thing the
// owner reads when the app refuses, so it has to name every blocker,
// pluralise, and point at Cancel rather than leaving a dead end.

import { describe, it, expect } from "vitest";
import { describeBlockers } from "../../../src/modules/projects/delete-shared";
import { ALL_PERMISSION_KEYS } from "../../../src/kernel/rbac/permissions";

describe("project delete blockers", () => {
  it("names a single blocker in the singular", () => {
    const s = describeBlockers([{ label: "invoice", count: 1 }]);
    expect(s).toContain("1 invoice");
    expect(s).not.toContain("1 invoices");
  });

  it("pluralises a count above one", () => {
    const s = describeBlockers([{ label: "receipt", count: 3 }]);
    expect(s).toContain("3 receipts");
  });

  it("joins two blockers with 'and', not a comma", () => {
    const s = describeBlockers([
      { label: "invoice", count: 2 },
      { label: "order",   count: 1 },
    ]);
    expect(s).toContain("2 invoices and 1 order");
  });

  it("comma-separates three or more, with 'and' before the last", () => {
    const s = describeBlockers([
      { label: "invoice",        count: 1 },
      { label: "receipt",        count: 2 },
      { label: "stock movement", count: 4 },
    ]);
    expect(s).toContain("1 invoice, 2 receipts and 4 stock movements");
  });

  it("always points at cancelling instead of dead-ending", () => {
    const s = describeBlockers([{ label: "payment", count: 1 }]);
    expect(s).toMatch(/cancel/i);
  });
});

describe("delete permission keys", () => {
  // The buttons are gated on these two keys. A typo in the registry
  // would silently hide both controls from every role including Owner,
  // since session.ts derives allPermissions() from the registry itself.
  it("registers project.delete and expense.delete", () => {
    expect(ALL_PERMISSION_KEYS).toContain("project.delete");
    expect(ALL_PERMISSION_KEYS).toContain("expense.delete");
  });
});
