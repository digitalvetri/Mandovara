"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FORBIDDEN_DIGEST_PREFIX } from "@/kernel/rbac/guard";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

// Most crashes seen in production are transient: while the container
// restarts (deploy, crash recovery) the proxy answers 502, a JS chunk or
// the Server Component payload fails to load, and this boundary renders.
// A full reload a few seconds later succeeds. So reload once, automatically.
// The timestamp in sessionStorage stops a real, repeatable bug from
// looping — the second failure inside the window stays on this screen.
const AUTO_RELOAD_KEY = "mandovara:error-auto-reload";
const AUTO_RELOAD_DELAY_MS = 3000;
const AUTO_RELOAD_WINDOW_MS = 60_000;

function claimAutoReload(): boolean {
  try {
    // Per page, so a blip on one page doesn't disable recovery on the next.
    const key = `${AUTO_RELOAD_KEY}:${window.location.pathname}`;
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < AUTO_RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false; // storage blocked — never risk a reload loop
  }
}

export default function AppError({ error, reset }: Props) {
  const isForbidden =
    error.digest?.startsWith(FORBIDDEN_DIGEST_PREFIX) ||
    error.name === "ForbiddenError" || error.message.includes("Missing permission");
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    // Only log unexpected errors — not permission denials
    if (isForbidden) return;
    console.error("[AppError boundary]", error);
    if (!claimAutoReload()) return;
    setReloading(true);
    const t = setTimeout(() => window.location.reload(), AUTO_RELOAD_DELAY_MS);
    return () => clearTimeout(t);
  }, [error, isForbidden]);

  if (isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="text-[48px] leading-none font-display font-semibold text-text-dim">403</div>
        <div className="space-y-1">
          <p className="text-[16px] font-medium text-text">Access denied</p>
          <p className="text-[13px] text-text-dim max-w-xs">
            Your role doesn&apos;t include the permission required for this page.
            Contact the studio owner to adjust your access.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={"/" as Route}
            className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-surface-2 border border-rule text-text hover:bg-surface-3 transition-colors flex items-center"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
      <div className="text-[48px] leading-none font-display font-semibold text-fault">!</div>
      <div className="space-y-1">
        <p className="text-[16px] font-medium text-text">Something went wrong</p>
        <p className="text-[13px] text-text-dim max-w-xs">
          {reloading
            ? "Reconnecting — this page will reload in a moment."
            : "An unexpected error occurred. Try refreshing, or go back to the dashboard."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          // A full reload, not just reset(): reset() re-renders with the
          // same failed chunk / payload and usually fails again.
          onClick={() => { reset(); window.location.reload(); }}
          className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-accent text-ink hover:bg-accent-strong transition-colors"
        >
          Try again
        </button>
        <Link
          href={"/" as Route}
          className="h-9 px-4 rounded-[8px] text-[13px] font-medium bg-surface-2 border border-rule text-text hover:bg-surface-3 transition-colors flex items-center"
        >
          Dashboard
        </Link>
      </div>
      {/* Temporarily surface the underlying error message + digest in
          prod too. Owner is hitting unexplained crashes and there's no
          server-log access; the message is safe (no PII / secrets in
          Prisma runtime errors) and the digest lets us correlate with
          Coolify logs when we do get access. Roll back to dev-only
          once the current class of bugs is understood. */}
      <details className="mt-2 max-w-md text-left">
        <summary className="cursor-pointer text-[11px] text-text-subtle hover:text-text-dim">Show details</summary>
        <pre className="mt-1 rounded-[6px] bg-surface-2 border border-rule px-2 py-1 text-[10.5px] font-data whitespace-pre-wrap break-words text-text-dim">
          {error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
