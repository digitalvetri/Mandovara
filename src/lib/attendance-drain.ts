// Drain worker for the attendance punch PWA (Phase 7).
// Mirrors measure-drain.ts — fires on online / visibilitychange.
// Processes the IndexedDB outbox in FIFO order so punch-in always
// reaches the server before punch-out.

import {
  listPendingPunches, markPunchSending, markPunchSent, markPunchFailed,
} from "./attendance-outbox";
import { punchSelf } from "@/modules/attendance/actions";

const MAX_TRIES       = 5;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS  = 30_000;

export interface AttendanceDrainSummary {
  attempted: number;
  sent:      number;
  failed:    number;
  remaining: number;
}

/** Drain all pending punches. Safe to call concurrently — "sending" rows
 *  are short-circuited. Returns a summary of this drain pass. */
export async function drainAttendance(): Promise<AttendanceDrainSummary> {
  const now     = Date.now();
  const summary: AttendanceDrainSummary = {
    attempted: 0, sent: 0, failed: 0, remaining: 0,
  };

  const rows = await listPendingPunches();

  for (const row of rows) {
    if (row.state === "sending") continue;
    if (row.tries >= MAX_TRIES) continue;
    if (row.tries > 0) {
      const wait = Math.min(BACKOFF_BASE_MS * 2 ** (row.tries - 1), BACKOFF_CAP_MS);
      if (now - row.createdAt < wait) continue;
    }

    summary.attempted += 1;
    await markPunchSending(row.id);

    try {
      const res = await punchSelf({
        clientId:  row.id,
        type:      row.type,
        timestamp: row.timestamp,
        lat:       row.lat,
        lng:       row.lng,
      });
      if (res.ok) {
        await markPunchSent(row.id);
        summary.sent += 1;
      } else {
        await markPunchFailed(row.id, res.error ?? "unknown");
        summary.failed += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network";
      await markPunchFailed(row.id, msg);
      summary.failed += 1;
    }
  }

  const remaining = await listPendingPunches();
  summary.remaining = remaining.filter((r) => r.state !== "sending").length;
  return summary;
}

/** Wire up window events. Call once from the PWA component on mount.
 *  Returns a disposer. Fires once immediately so any pending rows from
 *  a previous session drain without requiring a user tap. */
export function attachAttendanceDrainListeners(
  onDrain: (summary: AttendanceDrainSummary) => void,
): () => void {
  const run = (): void => {
    drainAttendance().then(onDrain).catch(() => { /* swallowed; next event retries */ });
  };

  const onOnline  = (): void => { if (navigator.onLine) run(); };
  const onVisible = (): void => { if (document.visibilityState === "visible") run(); };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  run();

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
