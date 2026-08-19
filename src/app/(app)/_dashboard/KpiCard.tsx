interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendTone: "good" | "warn" | "bad";
  icon?: string;  // emoji icon for the card
}

// Token classes, not literals: these used to be frozen hex values keyed to
// the old dark palette, so the trend pill kept its Midnight Court colours
// after the theme changed and lost contrast on a light card.
const toneClass: Record<KpiCardProps["trendTone"], string> = {
  good: "text-solid bg-solid/10",
  warn: "text-heat  bg-heat/10",
  bad:  "text-fault bg-fault/10",
};

const defaultIcon: Record<string, string> = {
  "Revenue (MTD)":      "₹",
  "Active Projects":    "◈",
  "Open Leads":         "◉",
  "Overdue Invoices":   "⚠",
};

export function KpiCard({ label, value, subtitle, trend, trendTone, icon }: KpiCardProps) {
  const tone = toneClass[trendTone];
  const displayIcon = icon ?? defaultIcon[label];

  return (
    <div
      className="rounded-[14px] bg-surface border border-rule border-l-[3px] border-l-accent px-5 py-4 relative overflow-hidden shadow-sm"
    >
      {/* Subtle teal glow top-right */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-dim leading-none">
          {label}
        </div>
        {displayIcon && (
          <div
            className="h-7 w-7 rounded-[8px] flex items-center justify-center text-[13px] shrink-0 bg-accent/10 text-accent"
          >
            {displayIcon}
          </div>
        )}
      </div>

      <div className="mt-3 font-display text-[28px] leading-none font-semibold text-text tabular-nums">
        {value}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[11px] text-text-dim truncate flex-1">{subtitle}</div>
        <span
          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular shrink-0 ${tone}`}
        >
          {trend}
        </span>
      </div>
    </div>
  );
}
