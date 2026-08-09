// Phase 5c-PWA — IndexedDB outbox for offline install-visit mutations.
//
// Hand-rolled (no `idb` dependency). One database "mandovara-outbox",
// one store "pending", records shaped {id, kind, payload, tries,
// createdAt, error?}. Wire flow:
//
//   enqueue()  → always writes to IDB, then optimistically triggers
//                a drain if navigator.onLine.
//   drain()    → iterates pending records, dispatches to the matching
//                server action, deletes on success. Single-flight —
//                a second concurrent call no-ops so a rapid "online"
//                storm doesn't double-fire mutations.
//   __peekOutbox() → debug hook exposed on window for the Playwright
//                verifier to assert queue state offline.
//
// Kinds this session:
//   "completeInstallLine"    → payload: CompleteInstallLineInput
//   "signAndCompleteVisit"   → payload: SignAndCompleteVisitInput

import {
  completeInstallLine, signAndCompleteVisit,
} from "@/modules/install/actions";

// ── Types ────────────────────────────────────────────────────────

export type OutboxKind = "completeInstallLine" | "signAndCompleteVisit";

export interface OutboxRecord {
  id:        string;             // uuid-lite, monotonic-enough for FIFO
  kind:      OutboxKind;
  payload:   unknown;            // schema-shaped for the matching action
  tries:     number;
  createdAt: number;             // Date.now() at enqueue
  lastError?: string;
}

// ── IndexedDB plumbing ───────────────────────────────────────────

const DB_NAME = "mandovara-outbox";
const DB_VERSION = 1;
const STORE = "pending";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, mode);
  return tx.objectStore(STORE);
}

function reqAsPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

function shortId(): string {
  // Not cryptographic — just needs to be unique per browser session.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public API ───────────────────────────────────────────────────

export async function enqueue(kind: OutboxKind, payload: unknown): Promise<OutboxRecord> {
  const rec: OutboxRecord = {
    id: shortId(), kind, payload, tries: 0, createdAt: Date.now(),
  };
  const store = await txStore("readwrite");
  await reqAsPromise(store.add(rec));
  // Best-effort immediate drain — safe to fail silently, the sync
  // loop handles it on next online/visibility event.
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void drain();
  }
  return rec;
}

export async function peekOutbox(): Promise<OutboxRecord[]> {
  const store = await txStore("readonly");
  return reqAsPromise(store.getAll() as IDBRequest<OutboxRecord[]>);
}

async function deleteRecord(id: string): Promise<void> {
  const store = await txStore("readwrite");
  await reqAsPromise(store.delete(id));
}

async function updateRecord(rec: OutboxRecord): Promise<void> {
  const store = await txStore("readwrite");
  await reqAsPromise(store.put(rec));
}

// Single-flight lock — a rapid "online" storm can fire drain() twice;
// the second call sees this flag and no-ops. Reset on completion.
let draining = false;

export async function drain(): Promise<{ ok: number; failed: number }> {
  if (draining) return { ok: 0, failed: 0 };
  draining = true;
  let ok = 0, failed = 0;
  try {
    const pending = await peekOutbox();
    // FIFO by createdAt so per-visit ordering is preserved.
    pending.sort((a, b) => a.createdAt - b.createdAt);
    for (const rec of pending) {
      try {
        const res = await dispatch(rec);
        if (res.ok) {
          await deleteRecord(rec.id);
          ok++;
        } else {
          // Business-level rejection (e.g. over-install). Keep in
          // queue with error stamped so the UI can surface it, but
          // bump tries so we don't infinite-loop.
          rec.tries += 1;
          rec.lastError = res.error ?? "unknown";
          await updateRecord(rec);
          failed++;
        }
      } catch (e) {
        // Network / server 500 — leave in queue for next drain.
        rec.tries += 1;
        rec.lastError = (e as Error).message;
        await updateRecord(rec);
        failed++;
      }
    }
  } finally {
    draining = false;
  }
  return { ok, failed };
}

interface ActionRes { ok: boolean; error?: string }

async function dispatch(rec: OutboxRecord): Promise<ActionRes> {
  switch (rec.kind) {
    case "completeInstallLine":
      return (await completeInstallLine(rec.payload)) as ActionRes;
    case "signAndCompleteVisit":
      return (await signAndCompleteVisit(rec.payload)) as ActionRes;
  }
}

// Registers the sync loop on the browser. Idempotent — subsequent
// calls remove existing listeners first. Also runs one immediate
// drain in case anything was queued from a prior session.
let installed = false;
export function installSyncLoop(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const onOnline = () => { void drain(); };
  const onVisible = () => {
    if (document.visibilityState === "visible" && navigator.onLine) void drain();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  // Initial pass — anything left from a previous mobile session.
  if (navigator.onLine) void drain();

  // Debug hook for the Playwright verifier — reads the queue without
  // going through a server action.
  (window as unknown as { __peekOutbox?: () => Promise<OutboxRecord[]> }).__peekOutbox = peekOutbox;
  (window as unknown as { __drainOutbox?: () => Promise<unknown> }).__drainOutbox = drain;
}
