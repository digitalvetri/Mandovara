// Next.js runtime instrumentation entry-point. Registered automatically —
// see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation.
//
// Sentry is fully gated on SENTRY_DSN. When the DSN is unset (as in local
// dev and in production before you paste one into Coolify), Sentry.init
// is enabled:false and makes zero network calls.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env["SENTRY_DSN"];

export async function register() {
  if (!DSN) return; // no-op when DSN not configured

  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    Sentry.init({
      dsn: DSN,
      enabled: true,
      environment: process.env["NODE_ENV"] ?? "development",
      tracesSampleRate: 0.1,
      // Don't send PII by default — quote amounts, client names etc. are
      // sensitive. Turn on per-event with setContext / setTag from server
      // actions if a case really needs it.
      sendDefaultPii: false,
    });
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    Sentry.init({
      dsn: DSN,
      enabled: true,
      environment: process.env["NODE_ENV"] ?? "development",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// Captures thrown errors from server actions, route handlers, RSCs.
export const onRequestError = Sentry.captureRequestError;
