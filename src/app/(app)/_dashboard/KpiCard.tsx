interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendTone: "good" | "warn" | "bad";
  icon?: string;  // emoji icon for the card
}

const toneStyle: Record<KpiCardProps["trendTone"], { text: string; bg: string }> = {
  good: { text: "#2BA89A", bg: "rgba(43,168,154,0.10)" },
  warn: { text: "#C97B30", bg: "rgba(201,123,48,0.10)" },
  bad:  { text: "#C94040", bg: "rgba(201,64,64,0.10)"  },
};

const defaultIcon: Record<string, string> = {
  "Revenue (MTD)":      "₹",
  "Active Projects":    "◈",
  "Open Leads":         "◉",
  "Overdue Invoices":   "⚠",
};

export function KpiCard({ label, value, subtitle, trend, trendTone, icon }: KpiCardProps) {
  const tone = toneStyle[trendTone];
  const displayIcon = icon ?? defaultIcon[label];

  return (
    <div
      className="rounded-[14px] bg-surface border border-rule px-5 py-4 relative overflow-hidden"
      style={{ borderLeft: "3px solid #2BA89A" }}
    >
      {/* Subtle teal glow top-right */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(43,168,154,0.06) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-dim leading-none">
          {label}
        </div>
        {displayIcon && (
          <div
            className="h-7 w-7 rounded-[8px] flex items-center justify-center text-[13px] shrink-0"
            style={{ background: "rgba(43,168,154,0.10)", color: "#2BA89A" }}
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
          className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular shrink-0"
          style={{ color: tone.text, background: tone.bg }}
        >
          {trend}
        </span>
      </div>
    </div>
  );
}
