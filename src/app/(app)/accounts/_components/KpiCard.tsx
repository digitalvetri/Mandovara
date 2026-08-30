import Link from "next/link";
import type { Route } from "next";
import { InfoTip } from "@/components/ui/Tooltip";

interface Props {
  label:     string;
  /** Formatted rupee value (e.g. "₹8,42,000"). */
  value:     string;
  /** Plain-English sub-line — every number has context. */
  subLine:   React.ReactNode;
  /** One-sentence "?" explainer. */
  helpText:  string;
  /** Route the whole card taps through to. */
  href:      string;
  /** When true, the sub-line renders in the fault tone (used for "late" copy). */
  emphasize?: "warn" | "bad" | null;
  /** Hero variant: full-width, larger number, used on phone for TO COLLECT. */
  hero?: boolean;
}

export function KpiCard({ label, value, subLine, helpText, href, emphasize, hero }: Props) {
  const tone =
    emphasize === "bad"  ? "text-bad"  :
    emphasize === "warn" ? "text-warn" :
                            "text-text-dim";

  return (
    <Link
      href={href as Route}
      className={[
        "group block rounded-[14px] bg-surface border border-rule px-4 sm:px-5 py-4 transition-colors hover:border-gold/60",
        hero ? "sm:col-span-full sm:px-6 sm:py-5" : "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-dim">{label}</span>
        <InfoTip content={helpText} label={`About ${label}`} />
      </div>
      <div
        className={[
          "font-display tabular-nums font-semibold leading-none text-text",
          hero ? "text-[24px] sm:text-[42px]" : "text-[19px] sm:text-[26px]",
        ].join(" ")}
      >
        {value}
      </div>
      <div className={`mt-2 text-[12px] leading-snug ${tone}`}>
        {subLine}
      </div>
    </Link>
  );
}
