// Event bus + tx-scoped collector.
//
// The bus itself is a typed pub/sub. In production, subscribers on the "hot"
// path are:
//   - the automation rule engine (Session 13)
//   - the WhatsApp trigger runner (Session 20)
//   - dashboard invalidation
//   - the audit log (already wired via a different extension; kept
//     out of the event bus by design so audit doesn't depend on it)
//
// docs/BUILD-SPEC.md §8.2 item 5:
//   "Publishing happens inside the transaction; handlers run after commit
//    via BullMQ."
//
// This session lands the in-process bus + tx-scoped collector. Session 8+
// swaps the in-process publish for a BullMQ enqueue that survives crashes.

import type { DomainEvent, DomainEventType, EventOf } from "./types";

// ── The bus ─────────────────────────────────────────────────
export type EventHandler<T extends DomainEventType> = (e: EventOf<T>) => Promise<void> | void;

class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<DomainEventType>>>();

  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    // Force cast — handler is variance-safe at the call site (publish
    // narrows on type before invoking).
    set.add(handler as unknown as EventHandler<DomainEventType>);
    return () => this.handlers.get(type)?.delete(handler as unknown as EventHandler<DomainEventType>);
  }

  async publish(event: DomainEvent): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set) return;
    // Run handlers sequentially inside the "after commit" window. Any
    // single handler failure is logged (via console.error) but does not
    // cascade — a WhatsApp send failure must not roll back a stock issue.
    for (const h of set) {
      try {
        await (h as unknown as EventHandler<typeof event.type>)(event);
      } catch (err: unknown) {
        console.error(`[event ${event.type}] handler failed:`, err);
      }
    }
  }

  /** Test helper — remove all handlers. */
  clear(): void { this.handlers.clear(); }

  /** Test helper — number of subscribers for a given type. */
  count(type: DomainEventType): number { return this.handlers.get(type)?.size ?? 0; }
}

export const bus: EventBus = new EventBus();

// ── Tx-scoped collector ─────────────────────────────────────
// Events emitted inside a transaction are buffered and dispatched AFTER
// commit. Consumers use `collectEvents()` to get a scoped publisher and a
// flush function; wrap them around your withTransaction call.
//
// Example:
//   const { publish, flush } = collectEvents();
//   await withTransaction(async (tx) => {
//     await tx.invoice.create(...);
//     publish({ type: "invoice.created", ... });
//   });
//   await flush();

export interface EventCollector {
  readonly publish: (event: DomainEvent) => void;
  readonly flush: () => Promise<void>;
  readonly pending: () => readonly DomainEvent[];
}

export function collectEvents(): EventCollector {
  const buffer: DomainEvent[] = [];
  return {
    publish(event: DomainEvent) { buffer.push(event); },
    async flush() {
      const toSend = buffer.splice(0, buffer.length);
      for (const e of toSend) await bus.publish(e);
    },
    pending() { return buffer; },
  };
}

/**
 * Convenience wrapper — publish an event AFTER the enclosing transaction
 * commits. Runs `fn(publish)`, then flushes on success. On failure the
 * buffer is discarded (nothing dispatched).
 */
export async function withEvents<R>(
  fn: (publish: (e: DomainEvent) => void) => Promise<R>,
): Promise<R> {
  const c = collectEvents();
  const result = await fn(c.publish);
  await c.flush();
  return result;
}
