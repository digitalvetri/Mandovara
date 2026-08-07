interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendTone: "good" | "warn" | "bad";
}

const toneClass: Record<KpiCardProps["trendTone"], string> = {
  good: "text-good bg-good/12",
  warn: "text-warn bg-warn/15",
  bad:  "text-bad  bg-bad/12",
};

export function KpiCard({ label, value, subtitle, trend, trendTone }: KpiCardProps) {
  return (
    <div className="rounded-[12px] bg-surface border border-rule px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          {label}
        </div>
        <span
          className={`text-[10.5px] leading-none px-2 py-1 rounded-full font-medium tabular max-w-[80px] truncate ${toneClass[trendTone]}`}
        >
          {trend}
        </span>
      </div>
      <div className="mt-2 font-display text-[26px] leading-none font-semibold text-text tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-text-dim truncate">{subtitle}</div>
    </div>
  );
}
