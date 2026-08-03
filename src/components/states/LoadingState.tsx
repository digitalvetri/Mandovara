// No full-page spinners (BUILD-SPEC §6.1). Streaming + skeletons that match
// the real layout. LoadingState renders N skeleton rows at the standard 34px
// row height (§5.4).

interface LoadingStateProps {
  rows?: number;
}

export function LoadingState({ rows = 8 }: LoadingStateProps) {
  return (
    <div
      className="w-full"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-rule flex items-center gap-6 px-6 h-[34px]"
        >
          <div className="skeleton h-3 w-24 rounded-sm" />
          <div className="skeleton h-3 w-56 rounded-sm" />
          <div className="skeleton h-3 w-20 rounded-sm ml-auto" />
          <div className="skeleton h-3 w-16 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
