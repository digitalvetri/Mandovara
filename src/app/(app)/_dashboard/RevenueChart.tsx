import type { RevenueMonth } from "./types";

export function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const max     = months.reduce((m, x) => (x.lakhs > m ? x.lakhs : m), 0);
  const total   = months.reduce((s, x) => s + x.lakhs, 0);

  // A month with zero revenue is silence, not data. Rendering it as a tiny
  // sliver plus a "0.0" label repeated seven times reads as broken. Show
  // silence as a hairline baseline tick + no numeric label.
  const isSilent = (v: number) => v === 0;

  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Revenue
          </div>
          <div className="mt-0.5 font-display text-[17px] font-semibold text-text">
            Last 8 months
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">Total</div>
          <div className="mt-0.5 font-data text-[15px] font-medium text-text tabular-nums">
            {total > 0 ? `₹${total.toFixed(1)}L` : "—"}
          </div>
        </div>
      </div>

      {/* Chart plot with a hairline peak-reference line + label */}
      <div className="relative h-[172px]">
        {max > 0 && (
          <div
            className="absolute inset-x-0 border-t border-dashed border-rule pointer-events-none"
            style={{ top: `0%` }}
            aria-hidden
          >
            <span className="absolute -top-3.5 right-0 text-[10px] tabular text-text-dim">
              {max.toFixed(1)}
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 h-full">
          {months.map((m) => {
            const heightPct = max === 0 ? 0 : (m.lakhs / max) * 100;
            const silent    = isSilent(m.lakhs);
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex flex-col items-center justify-end">
                  {!silent && (
                    <div className="font-data text-[10.5px] text-text-muted tabular-nums mb-1.5">
                      {m.lakhs.toFixed(1)}
                    </div>
                  )}
                  {silent ? (
                    <div
                      className="w-[68%] h-[2px] bg-rule rounded-full"
                      aria-hidden
                      title={`${m.label}: no revenue`}
                    />
                  ) : (
                    <div
                      className="w-[68%] bg-accent rounded-t-[3px] hover:bg-accent-hover transition-colors"
                      style={{ height: `${heightPct}%` }}
                    />
                  )}
                </div>
                <div className={`text-[10.5px] uppercase tracking-[0.14em] ${silent ? "text-text-faint" : "text-text-muted"}`}>
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
