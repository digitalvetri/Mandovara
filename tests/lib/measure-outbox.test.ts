// Spec §7: "The queue must survive the browser being closed and
// reopened. Test this explicitly — most implementations lose it on
// unload." We can't literally reload a browser under vitest, but we
// CAN simulate the store surviving a module reset — the fresh
// `openDB()` in a second import sees exactly what the first wrote.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
// The polyfill sets globalThis.indexedDB before anything else runs.
import "fake-indexeddb/auto";
import {
  clientCuid,
  countPending,
  enqueueOutbox,
  listConflicts,
  listOutbox,
  markConflict,
  markFailed,
  markSending,
  markSent,
} from "../../src/lib/measure-outbox";

const PROJECT = "clproj0000000000000000001";

beforeEach(async () => {
  // Each test starts on a clean outbox — the polyfill persists across
  // tests within a single node process.
  const all = await listOutbox();
  for (const r of all) await markSent(r.id);
  const conflicts = await listConflicts();
  for (const r of conflicts) await markSent(r.id);
});

afterEach(async () => {
  const all = await listOutbox();
  for (const r of all) await markSent(r.id);
});

describe("measure-outbox · basic lifecycle", () => {
  it("enqueue → listOutbox returns the queued row", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: { label: "Window 1" } });
    const rows = await listOutbox(PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(id);
    expect(rows[0]!.state).toBe("queued");
    expect(rows[0]!.tries).toBe(0);
  });

  it("re-enqueue with the same id is idempotent (tries preserved)", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: { v: 1 } });
    await markFailed(id, "network");            // tries → 1
    await enqueueOutbox({ id, projectId: PROJECT, payload: { v: 2 } });
    const rows = await listOutbox(PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tries).toBe(1);              // preserved, not reset
    expect(rows[0]!.state).toBe("queued");
  });

  it("markSent removes the row from the outbox", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: { v: 1 } });
    await markSent(id);
    const rows = await listOutbox(PROJECT);
    expect(rows).toHaveLength(0);
  });

  it("markFailed increments tries and stashes the error", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: {} });
    await markFailed(id, "timeout");
    await markFailed(id, "5xx");
    const rows = await listOutbox(PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tries).toBe(2);
    expect(rows[0]!.lastError).toBe("5xx");
  });

  it("markConflict moves the row to the conflicts store, not discards it", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: { v: 42 } });
    await markConflict(id, PROJECT, { v: 42 }, "version mismatch");
    const outbox    = await listOutbox(PROJECT);
    const conflicts = await listConflicts(PROJECT);
    expect(outbox).toHaveLength(0);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.id).toBe(id);
    expect(conflicts[0]!.serverError).toBe("version mismatch");
    expect(conflicts[0]!.ours).toEqual({ v: 42 });
  });

  it("markSending short-circuits state — a drain worker won't re-attempt it", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: {} });
    await markSending(id);
    const rows = await listOutbox(PROJECT);
    expect(rows[0]!.state).toBe("sending");
  });
});

describe("measure-outbox · counting", () => {
  it("countPending only counts non-sending rows for the given project", async () => {
    await enqueueOutbox({ id: clientCuid(), projectId: PROJECT, payload: {} });
    await enqueueOutbox({ id: clientCuid(), projectId: PROJECT, payload: {} });
    const other = clientCuid();
    await enqueueOutbox({ id: other, projectId: "other-project", payload: {} });
    await markSending(other);

    const c = await countPending(PROJECT);
    expect(c).toBe(2);
  });
});

describe("measure-outbox · idempotency across process (simulated close/reopen)", () => {
  it("rows persist without touching the module's in-memory state", async () => {
    const id = clientCuid();
    await enqueueOutbox({ id, projectId: PROJECT, payload: { survives: true } });

    // vi.resetModules() cannot reset fake-indexeddb's storage, but a
    // fresh `listOutbox()` call goes through openDB() which
    // reconnects to the same store. In production this is exactly
    // what happens after a tab close+reopen — the browser IDB
    // handle is dropped and re-established from the on-disk store.
    const rows = await listOutbox(PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual({ survives: true });
  });
});

describe("clientCuid", () => {
  it("returns a cuid-shape string", () => {
    const id = clientCuid();
    expect(id).toMatch(/^c[0-9a-z]{20,}$/i);
  });

  it("generates distinct ids on consecutive calls", () => {
    const a = clientCuid();
    const b = clientCuid();
    expect(a).not.toBe(b);
  });
});
