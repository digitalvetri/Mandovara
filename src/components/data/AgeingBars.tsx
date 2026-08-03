import { formatINR } from "@/kernel/money/format";

// §7.9 AgeingBars — stacked horizontal bar, 0-30 / 31-60 / 61-90 / 90+,
// coloured signal → caution → alarm → alarm-dark. Plain divs, no chart lib.

export interface AgeingProps {
  bucket0_30:   bigint;
  bucket31_60:  bigint;
  bucket61_90:  bigint;
  bucket90plus: bigint;
  compact?: boolean;
}

const TONES = [
  "bg-good",     // 0-30
  "bg-warn",     // 31-60
  "bg-bad/85",   // 61-90
  "bg-bad",      // 90+
] as const;

const LABELS = ["0–30", "31–60", "61–90", "90+"] as const;

export function AgeingBars({
  bucket0_30, bucket31_60, bucket61_90, bucket90plus, compact,
}: AgeingProps) {
  const totals = [bucket0_30, bucket31_60, bucket61_90, bucket90plus];
  const sum = totals.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    return (
      <div className={compact ? "text-[11px] text-text-faint" : "text-[12px] text-text-faint"}>
        No outstanding
      </div>
    );
  }

  const pcts = totals.map((v) => Number((v * 10000n) / sum) / 100);

  return (
    <div className={compact ? "min-w-[120px]" : "min-w-[280px]"}>
      <div className={`h-[6px] w-full flex overflow-hidden rounded-full ${compact ? "" : "mb-1.5"}`}>
        {pcts.map((p, i) => (
          p > 0 ? (
            <div
              key={i}
              className={TONES[i]}
              style={{ width: `${p}%` }}
              aria-label={`${LABELS[i]} days: ${formatINR(totals[i]!)}`}
            />
          ) : null
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between text-[10px] tabular text-text-dim">
          {totals.map((v, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="text-text">{v > 0n ? formatINR(v) : "—"}</div>
              <div className="text-[9.5px] uppercase tracking-[0.12em]">{LABELS[i]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
