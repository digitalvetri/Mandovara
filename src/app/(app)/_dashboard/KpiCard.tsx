interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendTone: "good" | "warn" | "bad";
  // Colour of the vertical swatch strip on the card's left edge — a specimen
  // label from a fabric book. Defaults chosen by KPI label below.
  swatch?: "teal" | "gold" | "steel" | "fault";
}

// Trend pill tones. Kept as semantic token names so a theme flip does not
// strand these colours.
const toneClass: Record<KpiCardProps["trendTone"], string> = {
  good: "text-solid bg-solid/10",
  warn: "text-heat  bg-heat/10",
  bad:  "text-fault bg-fault/10",
};

// Signature — the left-edge swatch. Each KPI family gets its own strip so a
// glance down the row reads like a bolt sample: money → teal, projects →
// gold, pipeline → steel, overdue → vermilion.
const swatchClass: Record<NonNullable<KpiCardProps["swatch"]>, string> = {
  teal:  "bg-accent",
  gold:  "bg-gold",
  steel: "bg-[color:var(--color-info)]",
  fault: "bg-fault",
};

const defaultSwatch: Record<string, NonNullable<KpiCardProps["swatch"]>> = {
  "Revenue (MTD)":     "teal",
  "Active Projects":   "gold",
  "Open Leads":        "steel",
  "Overdue Invoices":  "fault",
};

export function KpiCard({ label, value, subtitle, trend, trendTone, swatch }: KpiCardProps) {
  const tone       = toneClass[trendTone];
  const strip      = swatchClass[swatch ?? defaultSwatch[label] ?? "teal"];

  return (
    <div className="group relative rounded-[14px] bg-surface border border-rule overflow-hidden shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px]">
      {/* Swatch strip — the signature. Full-height band on the left edge,
          coloured per KPI family. A row of these reads like specimen labels
          from a fabric book. 6px is the smallest width that still reads as
          "a strip" rather than "a hairline". */}
      <div aria-hidden className={`absolute inset-y-0 left-0 w-[6px] ${strip}`} />

      <div className="pl-7 pr-5 py-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-dim leading-none">
          {label}
        </div>

        {/* Numeral — mono, generous scale, gold hairline underline that
            draws in once on load. Signature per §6.1. */}
        <div className="mt-3 inline-block">
          <div className="font-data text-[30px] leading-none font-medium text-text tabular-nums tracking-[-0.01em]">
            {value}
          </div>
          <div className="kpi-underline mt-2 h-[1.5px] w-full bg-gold origin-left" aria-hidden />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-text-dim truncate flex-1">{subtitle}</div>
          <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full tabular shrink-0 ${tone}`}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  );
}
