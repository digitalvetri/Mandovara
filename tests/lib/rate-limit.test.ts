import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit, recordFailure, clearRateLimit, __resetRateLimits,
  LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS,
} from "@/lib/rate-limit";

describe("login rate limiter", () => {
  beforeEach(() => __resetRateLimits());

  it("allows the first attempt", () => {
    const r = checkRateLimit("k");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(LOGIN_MAX_ATTEMPTS);
  });

  it("blocks after the configured number of failures", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      expect(checkRateLimit("k").allowed).toBe(true);
      recordFailure("k");
    }
    const r = checkRateLimit("k");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts down remaining attempts", () => {
    recordFailure("k");
    expect(checkRateLimit("k").remaining).toBe(LOGIN_MAX_ATTEMPTS - 1);
    recordFailure("k");
    expect(checkRateLimit("k").remaining).toBe(LOGIN_MAX_ATTEMPTS - 2);
  });

  it("a success clears the counter", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) recordFailure("k");
    expect(checkRateLimit("k").allowed).toBe(false);
    clearRateLimit("k");
    expect(checkRateLimit("k").allowed).toBe(true);
  });

  it("the window expires", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      recordFailure("k", LOGIN_WINDOW_MS, t0);
    }
    expect(checkRateLimit("k", LOGIN_MAX_ATTEMPTS, t0).allowed).toBe(false);
    const after = t0 + LOGIN_WINDOW_MS + 1;
    expect(checkRateLimit("k", LOGIN_MAX_ATTEMPTS, after).allowed).toBe(true);
  });

  it("a failure after the window starts a fresh bucket", () => {
    const t0 = 1_000_000;
    recordFailure("k", LOGIN_WINDOW_MS, t0);
    const after = t0 + LOGIN_WINDOW_MS + 1;
    recordFailure("k", LOGIN_WINDOW_MS, after);
    expect(checkRateLimit("k", LOGIN_MAX_ATTEMPTS, after).remaining)
      .toBe(LOGIN_MAX_ATTEMPTS - 1);
  });

  it("keys are independent — one user cannot lock out another", () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) recordFailure("attacker");
    expect(checkRateLimit("attacker").allowed).toBe(false);
    expect(checkRateLimit("victim").allowed).toBe(true);
  });
});
