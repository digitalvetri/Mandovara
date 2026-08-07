import type { RevenueMonth } from "./types";

export function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const max = months.reduce((m, x) => (x.lakhs > m ? x.lakhs : m), 0);

  return (
    <div className="rounded-[12px] bg-surface border border-rule p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
            Revenue
          </div>
          <div className="mt-0.5 font-display text-[17px] font-semibold text-text">
            Last 8 months
          </div>
        </div>
        <div className="text-[10.5px] text-text-dim tabular">₹ in lakhs</div>
      </div>

      <div className="flex items-end justify-between gap-3 h-[160px]">
        {months.map((m) => {
          const heightPct = max === 0 ? 0 : (m.lakhs / max) * 100;
          return (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-2 h-full">
              <div className="flex-1 w-full flex flex-col items-center justify-end">
                <div className="tabular text-[10.5px] text-text-dim mb-1.5">
                  {m.lakhs.toFixed(1)}
                </div>
                <div
                  className="w-[68%] bg-accent rounded-t-[3px] hover:bg-accent-hover transition-colors"
                  style={{ height: `${Math.max(4, heightPct)}%` }}
                />
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
