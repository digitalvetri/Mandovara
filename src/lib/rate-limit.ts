// Fixed-window rate limiter for authentication attempts.
//
// Scope: in-process memory. This deployment runs as a single container
// (docker-compose / Coolify), so one process sees every login attempt. If the
// app is ever scaled to multiple replicas this must move to Redis — REDIS_URL
// is already provisioned. Recorded in docs/DECISIONS.md.
//
// Only FAILED attempts are counted. A correct password clears the counter, so
// a legitimate user who mistypes once is never locked out by their own success.

export interface RateLimitResult {
  allowed:        boolean;
  remaining:      number;
  retryAfterSec:  number;
}

interface Bucket {
  count:      number;
  resetAtMs:  number;
}

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_BUCKETS = 10_000;

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes

function sweep(nowMs: number): void {
  for (const [k, b] of buckets) {
    if (b.resetAtMs <= nowMs) buckets.delete(k);
  }
}

/**
 * Record nothing; just report whether `key` is currently allowed to try.
 * Call before doing the expensive bcrypt comparison.
 */
// The window length lives on the bucket (resetAtMs), set by recordFailure —
// so this only needs the attempt ceiling and the current time.
export function checkRateLimit(
  key: string,
  maxAttempts = LOGIN_MAX_ATTEMPTS,
  nowMs       = Date.now(),
): RateLimitResult {
  const b = buckets.get(key);
  if (!b || b.resetAtMs <= nowMs) {
    return { allowed: true, remaining: maxAttempts, retryAfterSec: 0 };
  }
  if (b.count >= maxAttempts) {
    return {
      allowed:       false,
      remaining:     0,
      retryAfterSec: Math.ceil((b.resetAtMs - nowMs) / 1000),
    };
  }
  return { allowed: true, remaining: maxAttempts - b.count, retryAfterSec: 0 };
}

/** Count one failed attempt against `key`. */
export function recordFailure(
  key:      string,
  windowMs = LOGIN_WINDOW_MS,
  nowMs    = Date.now(),
): void {
  if (buckets.size >= MAX_BUCKETS) sweep(nowMs);

  const b = buckets.get(key);
  if (!b || b.resetAtMs <= nowMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return;
  }
  b.count += 1;
}

/** Clear the counter for `key` — call on a successful authentication. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test-only: drop all state. */
export function __resetRateLimits(): void {
  buckets.clear();
}
