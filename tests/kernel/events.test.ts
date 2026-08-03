import { beforeEach, describe, expect, it } from "vitest";
import { bus, collectEvents, withEvents } from "@/kernel/events/bus";
import type { DomainEvent } from "@/kernel/events/types";

describe("event bus", () => {
  beforeEach(() => { bus.clear(); });

  it("subscribes, publishes, receives", async () => {
    const seen: DomainEvent[] = [];
    bus.subscribe("invoice.created", (e) => { seen.push(e); });
    await bus.publish({
      type: "invoice.created",
      orgId: "o1", actorId: "u1", occurredAt: new Date(),
      invoiceId: "i1", clientId: "c1", amount: 100n,
    });
    expect(seen).toHaveLength(1);
  });

  it("unsubscribe stops delivery", async () => {
    const seen: DomainEvent[] = [];
    const off = bus.subscribe("invoice.created", (e) => { seen.push(e); });
    off();
    await bus.publish({
      type: "invoice.created",
      orgId: "o1", actorId: "u1", occurredAt: new Date(),
      invoiceId: "i1", clientId: "c1", amount: 100n,
    });
    expect(seen).toHaveLength(0);
  });

  it("failing handler does not cascade to other handlers", async () => {
    const seen: string[] = [];
    bus.subscribe("invoice.created", () => { throw new Error("boom"); });
    bus.subscribe("invoice.created", () => { seen.push("second-ran"); });
    // Silence expected console.error from the failed handler
    const origErr = console.error;
    console.error = () => undefined;
    try {
      await bus.publish({
        type: "invoice.created",
        orgId: "o1", actorId: "u1", occurredAt: new Date(),
        invoiceId: "i1", clientId: "c1", amount: 100n,
      });
    } finally { console.error = origErr; }
    expect(seen).toEqual(["second-ran"]);
  });

  it("publishing an event with no subscribers is a no-op", async () => {
    await expect(bus.publish({
      type: "quotation.sent",
      orgId: "o", actorId: "u", occurredAt: new Date(),
      quotationId: "q", clientId: "c", channel: "whatsapp",
    })).resolves.toBeUndefined();
  });
});

describe("collectEvents (tx-scoped)", () => {
  beforeEach(() => { bus.clear(); });

  it("buffers events during work, flushes after", async () => {
    const seen: string[] = [];
    bus.subscribe("invoice.created", (e) => { seen.push(e.invoiceId); });
    const c = collectEvents();
    c.publish({ type: "invoice.created", orgId: "o", actorId: "u", occurredAt: new Date(),
                invoiceId: "buffered", clientId: "c", amount: 1n });
    // Not dispatched yet
    expect(seen).toEqual([]);
    expect(c.pending()).toHaveLength(1);
    await c.flush();
    expect(seen).toEqual(["buffered"]);
  });

  it("withEvents helper: happy path dispatches after fn returns", async () => {
    const seen: string[] = [];
    bus.subscribe("invoice.created", (e) => { seen.push(e.invoiceId); });
    await withEvents(async (publish) => {
      publish({ type: "invoice.created", orgId: "o", actorId: "u", occurredAt: new Date(),
                invoiceId: "we", clientId: "c", amount: 1n });
      // Nothing dispatched during fn body
      expect(seen).toEqual([]);
    });
    expect(seen).toEqual(["we"]);
  });

  it("withEvents helper: fn throwing prevents dispatch", async () => {
    const seen: string[] = [];
    bus.subscribe("invoice.created", (e) => { seen.push(e.invoiceId); });
    await expect(withEvents(async (publish) => {
      publish({ type: "invoice.created", orgId: "o", actorId: "u", occurredAt: new Date(),
                invoiceId: "should-not-dispatch", clientId: "c", amount: 1n });
      throw new Error("txn rolled back");
    })).rejects.toThrow("txn rolled back");
    expect(seen).toEqual([]);
  });
});
