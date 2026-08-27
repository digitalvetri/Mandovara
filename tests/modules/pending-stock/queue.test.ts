// The queue must actually remember a tick.
//
// The page it replaced was a static file: staff could see the 25
// unidentified rolls but ticking one changed nothing, so the same items
// came round every month and the answer found on the label was never
// written down. These tests pin the behaviour that fixes that.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { verifyPendingItem, discardPendingItem, reopenPendingItem } =
  await import("@/modules/pending-stock/actions");
const { getPendingQueue } = await import("@/modules/pending-stock/queries");

async function seedItem(t: Tenant, sourceId: string, code: string): Promise<string> {
  const row = await db.pendingStockItem.create({
    data: {
      organizationId: t.orgId,
      sourceId, groupKey: "mandovara-named", groupLabel: "Named — no catalogue match",
      source: "MANDOVARA STOCK", catalogueName: "FAITH", code,
      qty: "6", unit: "ROLL", confirmNeeded: "Brand name on selvedge",
    },
    select: { id: true },
  });
  return row.id;
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([...A.ctx.permissions, "inventory.view", "inventory.adjust"]),
  };
});

beforeEach(async () => { await db.pendingStockItem.deleteMany({}); });

describe("pending stock queue", () => {
  it("records WHAT THE LABEL SAID, not just that someone looked", async () => {
    // The whole reason for the trip to the showroom. Without brand and
    // collection the item cannot be added to the catalogue afterwards.
    const id = await seedItem(A, "F7047", "F7047");
    const res = await verifyPendingItem({
      id, brand: "Arham", collection: "Faith Vol 2", note: "selvedge partly torn",
    });
    expect(res.ok).toBe(true);

    const row = await db.pendingStockItem.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("VERIFIED");
    expect(row.foundBrand).toBe("Arham");
    expect(row.foundCollection).toBe("Faith Vol 2");
    expect(row.note).toBe("selvedge partly torn");
    expect(row.verifiedById).toBe(A.userId);
    expect(row.verifiedAt).not.toBeNull();
  });

  it("accepts a tick with no answer — a half-legible label still beats nothing", async () => {
    const id = await seedItem(A, "F7016", "F7016");
    const res = await verifyPendingItem({ id, note: "label unreadable" });
    expect(res.ok).toBe(true);
    const row = await db.pendingStockItem.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("VERIFIED");
    expect(row.foundBrand).toBeNull();
  });

  it("keeps 'identified' and 'does not exist' as different outcomes", async () => {
    // In a month's time these must not read the same.
    const id = await seedItem(A, "GHOST", "GHOST");
    await discardPendingItem({ id, note: "roll not in the showroom" });
    const row = await db.pendingStockItem.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("DISCARDED");
    expect(row.note).toBe("roll not in the showroom");
  });

  it("reopening clears the answer, so nothing stale looks confirmed", async () => {
    const id = await seedItem(A, "F7057", "F7057");
    await verifyPendingItem({ id, brand: "Wrong Brand", collection: "Wrong" });
    await reopenPendingItem(id);

    const row = await db.pendingStockItem.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("PENDING");
    // Leaving a stale brand on a reopened row is how someone later
    // "confirms" a thing nobody actually checked.
    expect(row.foundBrand).toBeNull();
    expect(row.foundCollection).toBeNull();
    expect(row.verifiedById).toBeNull();
    expect(row.verifiedAt).toBeNull();
  });

  it("counts progress so the page can show what is left", async () => {
    await seedItem(A, "a", "A");
    const b = await seedItem(A, "b", "B");
    await seedItem(A, "c", "C");
    await verifyPendingItem({ id: b, brand: "Arham" });

    // The same context the actions run under — the fixture's bare ctx
    // lacks inventory.view, which is correct and not what this asserts.
    const q = await getPendingQueue(ctxRef.current as never);
    expect(q.total).toBe(3);
    expect(q.checked).toBe(1);
    expect(q.groups[0]!.done).toBe(1);
  });

  it("refuses to tick an item that is gone", async () => {
    const res = await verifyPendingItem({ id: "does-not-exist", brand: "X" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no longer on the list/i);
  });
});
