// Shared bits used across the accounts tabs.

/** Delta line under a KPI card. `invert` = true for "Spent" (going up
 *  is bad); default is "Came in" (going up is good). */
export function DeltaText({
  current, previous, invert,
}: { current: bigint; previous: bigint; invert?: boolean }) {
  if (previous === 0n) {
    return (
      <span className="text-text-dim">
        {current === 0n ? "Nothing recorded yet" : "vs last month: new"}
      </span>
    );
  }
  const delta = Number(current - previous);
  const pct   = (delta / Number(previous)) * 100;
  const up    = pct >= 0;
  const isFavourable = invert ? !up : up;
  const tone = pct === 0
    ? "text-text-dim"
    : isFavourable ? "text-solid" : "text-warn";
  const arrow = pct === 0 ? "—" : up ? "▲" : "▼";
  return (
    <span className={tone}>
      {arrow} {Math.abs(pct).toFixed(0)}% vs last month
    </span>
  );
}

/** Days-late label used in list rows. "Due today", "N days late",
 *  or "in N days" for future due dates. */
export function daysLateLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0)  return `${Math.abs(daysUntilDue)} days late`;
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}
