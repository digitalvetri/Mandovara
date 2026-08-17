// IndexedDB outbox for the field attendance punch PWA (Phase 7).
// Mirrors measure-outbox.ts — same offline-first contract.
//
// Punches are idempotent server-side via (employeeId, date) unique key,
// so conflicts cannot arise — only queued / sending / failed states.
// Rows survive the browser closing.

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME    = "mandovara-attendance";
const DB_VERSION = 1;

export type PunchType  = "in" | "out";
export type PunchState = "queued" | "sending" | "failed";

export interface AttendancePunchRow {
  id:         string;       // client cuid — IndexedDB key; passed to server for idempotency
  type:       PunchType;
  timestamp:  string;       // ISO-8601 when the punch physically happened
  lat?:       number;
  lng?:       number;
  createdAt:  number;       // epoch ms
  tries:      number;
  lastError?: string;
  state:      PunchState;
}

interface AttendanceSchema {
  attendanceOutbox: AttendancePunchRow;
}

let dbPromise: Promise<IDBPDatabase<AttendanceSchema>> | null = null;

function openAttendanceDb(): Promise<IDBPDatabase<AttendanceSchema>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<AttendanceSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("attendanceOutbox")) {
        db.createObjectStore("attendanceOutbox", { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

export async function enqueuePunch(
  row: Omit<AttendancePunchRow, "createdAt" | "tries" | "state">,
): Promise<void> {
  const db       = await openAttendanceDb();
  const existing = await db.get("attendanceOutbox", row.id);
  await db.put("attendanceOutbox", {
    ...row,
    createdAt: existing?.createdAt ?? Date.now(),
    tries:     existing?.tries ?? 0,
    state:     "queued" as PunchState,
  });
}

export async function markPunchSending(id: string): Promise<void> {
  const db  = await openAttendanceDb();
  const row = await db.get("attendanceOutbox", id);
  if (!row) return;
  await db.put("attendanceOutbox", { ...row, state: "sending" });
}

export async function markPunchSent(id: string): Promise<void> {
  const db = await openAttendanceDb();
  await db.delete("attendanceOutbox", id);
}

export async function markPunchFailed(id: string, error: string): Promise<void> {
  const db  = await openAttendanceDb();
  const row = await db.get("attendanceOutbox", id);
  if (!row) return;
  await db.put("attendanceOutbox", {
    ...row,
    state:     "failed",
    tries:     row.tries + 1,
    lastError: error,
  });
}

export async function listPendingPunches(): Promise<AttendancePunchRow[]> {
  const db  = await openAttendanceDb();
  const all = await db.getAll("attendanceOutbox");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPendingPunches(): Promise<number> {
  const all = await listPendingPunches();
  return all.filter((r) => r.state !== "sending").length;
}

/** Client-side CUID for IndexedDB keying. Not used as server PK. */
export function attendanceCuid(): string {
  const t  = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return "a" + t + r1 + r2;
}
