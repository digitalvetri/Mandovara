// IndexedDB outbox for the field measurement PWA (§7 of the spec).
//
// Contract:
//   1. Writes go to the outbox FIRST, then optimistically to the UI,
//      then to the server when connectivity returns.
//   2. Every row carries a client-generated CUID — the server uses it
//      as the item PK so retries are no-ops (idempotent).
//   3. Rows survive the browser closing. IndexedDB persistence is
//      automatic; we never write to sessionStorage or keep state
//      in-memory across a page load.
//   4. On 409 (conflict) the loser moves to the `conflicts` store,
//      never discarded — surfaced in §5.5 conflict review.
//
// Kept small (< 300 lines) and framework-agnostic so it can be shared
// with the install PWA and any future measurer-facing capture surface.

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "mandovara-outbox";
const DB_VERSION = 1;

export type OutboxState = "queued" | "sending" | "conflict";

export interface OutboxRow {
  id:          string;          // client-generated cuid — the item PK on the server
  projectId:   string;
  payload:     unknown;         // the AddItemInput shape; typed at the callsite
  createdAt:   number;
  tries:       number;
  lastError?:  string;
  state:       OutboxState;
}

export interface ConflictRow {
  id:          string;          // reuses the outbox row id
  projectId:   string;
  ours:        unknown;         // the payload we tried to write
  serverError: string;
  detectedAt:  number;
}

interface OutboxSchema {
  measureOutbox: OutboxRow;
  measureConflicts: ConflictRow;
}

let dbPromise: Promise<IDBPDatabase<OutboxSchema>> | null = null;

function openOutboxDb(): Promise<IDBPDatabase<OutboxSchema>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<OutboxSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("measureOutbox")) {
        db.createObjectStore("measureOutbox", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("measureConflicts")) {
        db.createObjectStore("measureConflicts", { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

/**
 * Enqueue a measurement item write. Idempotent on `id` — a re-enqueue
 * from a retry keeps the row's tries counter but does not create a
 * duplicate.
 */
export async function enqueueOutbox(row: Omit<OutboxRow, "createdAt" | "tries" | "state">): Promise<void> {
  const db = await openOutboxDb();
  const existing = await db.get("measureOutbox", row.id);
  const merged: OutboxRow = {
    ...row,
    createdAt: existing?.createdAt ?? Date.now(),
    tries:     existing?.tries ?? 0,
    state:     existing?.state === "conflict" ? "conflict" : "queued",
  };
  await db.put("measureOutbox", merged);
}

export async function markSending(id: string): Promise<void> {
  const db = await openOutboxDb();
  const row = await db.get("measureOutbox", id);
  if (!row) return;
  await db.put("measureOutbox", { ...row, state: "sending" });
}

export async function markSent(id: string): Promise<void> {
  const db = await openOutboxDb();
  await db.delete("measureOutbox", id);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await openOutboxDb();
  const row = await db.get("measureOutbox", id);
  if (!row) return;
  await db.put("measureOutbox", {
    ...row,
    state:     "queued",
    tries:     row.tries + 1,
    lastError: error,
  });
}

/**
 * Move an item to the conflicts store. Called on 409 from the server.
 * The outbox row is deleted; the loser payload is preserved under the
 * same id so the conflict review UI (§5.5) can join it back to the
 * server row later.
 */
export async function markConflict(id: string, projectId: string, ours: unknown, serverError: string): Promise<void> {
  const db = await openOutboxDb();
  await db.put("measureConflicts", {
    id, projectId, ours, serverError, detectedAt: Date.now(),
  });
  await db.delete("measureOutbox", id);
}

export async function listOutbox(projectId?: string): Promise<OutboxRow[]> {
  const db = await openOutboxDb();
  const all = await db.getAll("measureOutbox");
  const rows = projectId ? all.filter((r) => r.projectId === projectId) : all;
  rows.sort((a, b) => a.createdAt - b.createdAt);
  return rows;
}

export async function listConflicts(projectId?: string): Promise<ConflictRow[]> {
  const db = await openOutboxDb();
  const all = await db.getAll("measureConflicts");
  const rows = projectId ? all.filter((r) => r.projectId === projectId) : all;
  rows.sort((a, b) => a.detectedAt - b.detectedAt);
  return rows;
}

export async function countPending(projectId?: string): Promise<number> {
  const all = await listOutbox(projectId);
  return all.filter((r) => r.state !== "sending").length;
}

export async function clearOutboxForProject(projectId: string): Promise<void> {
  const db = await openOutboxDb();
  const all = await db.getAll("measureOutbox");
  const tx = db.transaction("measureOutbox", "readwrite");
  for (const r of all) if (r.projectId === projectId) await tx.store.delete(r.id);
  await tx.done;
}

/**
 * Client-side CUID. Not cryptographically strong — that is by design.
 * The server owns collision detection via the PK constraint; the goal
 * here is a plausible-looking id we can put on wire immediately and
 * that stays stable across the queue's lifetime.
 */
export function clientCuid(): string {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 12);
  const r2 = Math.random().toString(36).slice(2, 12);
  return "c" + t + r1 + r2;
}

/** Type-safe cuid regex — matches @/schema.string().min(1) */
export function isClientCuid(s: string): boolean {
  return /^c[0-9a-z]{20,}$/i.test(s);
}
