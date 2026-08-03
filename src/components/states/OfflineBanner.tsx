// Copy pattern (BUILD-SPEC §6.8):
// "Working offline — 3 entries queued."
// Persistent banner. Queued rows carry a mono clock badge elsewhere.

interface OfflineBannerProps {
  queueCount: number;
}

export function OfflineBanner({ queueCount }: OfflineBannerProps) {
  const suffix = queueCount === 1 ? "entry" : "entries";
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-2 px-4 bg-ink-sunken border-b border-caution/40"
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-caution" />
      <span className="text-[13px] text-paper">
        Working offline —{" "}
        <span className="tabular text-caution">
          {queueCount} {suffix}
        </span>{" "}
        queued.
      </span>
    </div>
  );
}
