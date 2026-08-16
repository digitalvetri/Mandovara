// Sentry client-side init. Next.js 15.3+ picks this file up automatically.
// Gated on NEXT_PUBLIC_SENTRY_DSN — must be a NEXT_PUBLIC_ var so the
// browser bundle can see it. When unset, init is skipped entirely.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (DSN) {
  Sentry.init({
    dsn: DSN,
    enabled: true,
    environment: process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: 0.1,
    // Replays: session replay is expensive and PII-heavy. Off by default;
    // turn on selectively when debugging a specific issue.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
