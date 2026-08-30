import type { LucideIcon } from "lucide-react";
import { IndianRupee, Package, Users, FileText } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendTone: "good" | "warn" | "bad";
  /** The lead card of a row — dark ground, larger numeral. One per row. */
  featured?: boolean;
  icon?: LucideIcon;
}

// Trend pill tones. Semantic token names so a theme flip does not strand them.
const toneClass: Record<KpiCardProps["trendTone"], string> = {
  good: "text-solid bg-solid/10",
  warn: "text-heat  bg-heat/10",
  bad:  "text-fault bg-fault/10",
};

// Identity comes from an icon, not a colour.
//
// This row used to carry four differently coloured left strips — teal, ochre,
// blue, red — one per KPI. Nothing explained why Active Projects was gold and
// Open Leads blue, because nothing could: the colour encoded category, which a
// reader has no use for. Four saturated hues competing on one row is also what
// buried the only colour that DOES mean something, the red on money overdue.
//
// So: one accent for the whole row, red kept for genuine alarm, and the cards
// told apart by an icon and their own words.
const defaultIcon: Record<string, LucideIcon> = {
  "Revenue (MTD)":    IndianRupee,
  "Active Projects":  Package,
  "Open Leads":       Users,
  "Overdue Invoices": FileText,
};

export function KpiCard({
  label, value, subtitle, trend, trendTone, featured = false, icon,
}: KpiCardProps) {
  const tone  = toneClass[trendTone];
  const Icon  = icon ?? defaultIcon[label] ?? Package;
  // "bad" is the row's alarm state — currently only overdue money reaches it.
  const alarm = trendTone === "bad";

  return (
    <div
      className={[
        "lift group relative overflow-hidden rounded-[14px] border p-4 sm:p-5",
        featured
          ? "bg-sidebar border-transparent text-sidebar-text"
          : "bg-surface border-rule shadow-sm",
      ].join(" ")}
    >
      {featured && (
        <div aria-hidden className="pointer-events-none absolute inset-0 card-facets" />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className={[
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-[10px]",
              featured
                ? "bg-white/10 text-accent-chrome"
                : alarm
                  ? "bg-fault/10 text-fault"
                  : "bg-accent/10 text-accent",
            ].join(" ")}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden />
          </div>

          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular",
              // The tinted tones are mixed against a light card; on the dark
              // featured ground they sink into it.
              featured ? "bg-white/12 text-accent-chrome" : tone,
            ].join(" ")}
          >
            {trend}
          </span>
        </div>

        <div
          className={[
            "mt-3 sm:mt-4 text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.14em] leading-none",
            featured ? "text-sidebar-dim" : "text-text-dim",
          ].join(" ")}
        >
          {label}
        </div>

        {/* Numeral — mono and tabular so a row of them lines up, with the §6.1
            hairline drawing in beneath it once on load. Accent, not the old
            ochre: that gold was drawn for a dark ground and turns brown when
            darkened enough to be legible on white. */}
        <div className="mt-1.5 sm:mt-2 inline-block">
          <div
            className={[
              "font-data tabular-nums font-medium leading-none tracking-[-0.01em]",
              featured
                ? "text-[24px] sm:text-[34px] text-sidebar-text"
                : "text-[21px] sm:text-[30px] text-text",
            ].join(" ")}
          >
            {value}
          </div>
          <div
            aria-hidden
            className={[
              "kpi-underline mt-1.5 sm:mt-2 h-[1.5px] w-full",
              alarm ? "bg-fault/50" : "bg-accent/45",
            ].join(" ")}
          />
        </div>

        <div className={`mt-2 sm:mt-3 truncate text-[10.5px] sm:text-[11px] ${featured ? "text-sidebar-dim" : "text-text-dim"}`}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
