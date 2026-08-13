// Outbox drain worker for the field measurement PWA.
//
// Behaviour (§7 of the spec):
//   1. Drain fires when the tab returns online OR becomes visible.
//   2. Each pending row is POSTed via syncMeasurementItem(); success
//      deletes it from the outbox. HTTP-style status codes translate
//      to markSent / markFailed / markConflict.
//   3. Exponential-ish backoff — retries are capped so the loop
//      doesn't wedge on a permanently-broken payload.

import {
  listOutbox, markSending, markSent, markFailed, markConflict,
  type OutboxRow,
} from "./measure-outbox";
import { syncMeasurementItem } from "@/modules/measurement/actions-item";

const MAX_TRIES        = 8;
const BACKOFF_BASE_MS  = 1500;
const BACKOFF_CAP_MS   = 60_000;

export interface DrainSummary {
  attempted: number;
  sent:      number;
  conflicts: number;
  failed:    number;
  remaining: number;
}

/** Drain every queued row for a project. Safe to call concurrently
 *  — an in-progress row is short-circuited by state === "sending".
 *  A conflict outcome routes the row to the conflicts store where
 *  §5.5 review will pick it up. */
export async function drainProject(projectId: string): Promise<DrainSummary> {
  const started = Date.now();
  const summary: DrainSummary = { attempted: 0, sent: 0, conflicts: 0, failed: 0, remaining: 0 };
  const rows = await listOutbox(projectId);

  for (const row of rows) {
    if (row.state === "sending") continue;
    if (row.tries >= MAX_TRIES) continue;
    if (shouldWait(row, started)) continue;

    summary.attempted += 1;
    await markSending(row.id);
    try {
      const res = await syncMeasurementItem(row.payload);
      if (res.ok) {
        await markSent(row.id);
        summary.sent += 1;
      } else if (isConflict(res.error)) {
        await markConflict(row.id, projectId, row.payload, res.error ?? "conflict");
        summary.conflicts += 1;
      } else {
        await markFailed(row.id, res.error ?? "unknown");
        summary.failed += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network";
      await markFailed(row.id, msg);
      summary.failed += 1;
    }
  }

  const remaining = await listOutbox(projectId);
  summary.remaining = remaining.filter((r) => r.state !== "sending").length;
  return summary;
}

/** Simple backoff — after each failure, wait 1.5s × 2^tries capped at
 *  1 minute. Uses the row's lastError timestamp implicitly via createdAt
 *  when tries is 0; caller is expected to call drain on a natural
 *  event (online / visibilitychange) rather than a timer. */
function shouldWait(row: OutboxRow, now: number): boolean {
  if (row.tries === 0) return false;
  const wait = Math.min(BACKOFF_BASE_MS * 2 ** (row.tries - 1), BACKOFF_CAP_MS);
  return now - row.createdAt < wait;
}

/** Server-side messages we treat as a conflict. Loose match by
 *  design — the server writes user-facing text, we're matching on
 *  keywords. Precise codes will follow when the server action grows a
 *  `code:` field. */
function isConflict(error: string | undefined): boolean {
  if (!error) return false;
  return /conflict|already exist|approved|superseded|version/i.test(error);
}

/** Hook up window events. Call once from the top-level PWA layout.
 *  Returns a disposer that removes both listeners. */
export function attachDrainListeners(
  projectId: string,
  onDrain:   (summary: DrainSummary) => void,
): () => void {
  const run = (): void => {
    drainProject(projectId).then(onDrain).catch(() => {
      /* swallowed; next event will retry */
    });
  };
  const onOnline     = (): void => { if (navigator.onLine) run(); };
  const onVisible    = (): void => { if (document.visibilityState === "visible") run(); };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  // Fire once at attach time so a page load with pending rows drains
  // immediately (spec §5.3 — the flow must never require a user tap
  // to sync work that's already been captured).
  run();

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
