import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline · Mandovara" };

// Served by the service worker when a navigation fails with no network.
// Deliberately static and data-free — it must never imply that queued site
// captures were lost, because they were not.
export default function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center px-6 bg-bg text-text">
      <div className="max-w-[420px] text-center">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-dim mb-3">
          No connection
        </div>
        <h1 className="font-display text-[26px] font-semibold leading-tight mb-3">
          You&rsquo;re offline
        </h1>
        <p className="text-[13px] text-text-muted leading-relaxed">
          This page needs the network. Anything you captured on site — measurements,
          photos, attendance — is saved on this device and will sync by itself the
          moment you have signal. Nothing is lost.
        </p>
        <p className="text-[12px] text-text-faint mt-5">
          Reconnect and pull down to retry.
        </p>
      </div>
    </div>
  );
}
