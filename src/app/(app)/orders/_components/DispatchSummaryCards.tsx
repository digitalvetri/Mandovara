import type { DispatchStatusCounts } from "@/modules/orders/dispatch-queries";

const CARDS = [
  { key: "SCHEDULED",   label: "Scheduled",   border: "border-l-heat",   text: "text-heat"   },
  { key: "IN_PROGRESS", label: "In Progress",  border: "border-l-info",   text: "text-info"   },
  { key: "PARTIAL",     label: "Partial",      border: "border-l-heat",   text: "text-heat"   },
  { key: "COMPLETED",   label: "Completed",    border: "border-l-solid",  text: "text-solid"  },
  { key: "RESCHEDULED", label: "Rescheduled",  border: "border-l-rule",   text: "text-text-muted" },
  { key: "total",       label: "Total",        border: "border-l-accent", text: "text-accent" },
] as const;

export function DispatchSummaryCards({ counts }: { counts: DispatchStatusCounts }) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className={`rounded-[10px] bg-surface border border-rule border-l-[3px] ${c.border} px-3 py-2.5`}
        >
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-text-muted leading-none mb-1.5">
            {c.label}
          </div>
          <div className={`font-data text-[22px] tabular-nums leading-none font-semibold ${c.text}`}>
            {counts[c.key as keyof DispatchStatusCounts] ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}
