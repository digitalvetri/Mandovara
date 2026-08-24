import type { ActivityItem, ActivityKind } from "./types";

const dotClass: Record<ActivityKind, string> = {
  quote:   "bg-accent",
  payment: "bg-good",
  lead:    "bg-accent",
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-6">
      <div className="mb-5">
        <div className="font-display text-[18px] font-semibold text-text">
          Recent activity
        </div>
      </div>

      <div className="space-y-1">
        {items.map((a, i) => (
          <div
            key={a.id}
            className={[
              "flex items-start gap-3 py-2.5",
              i < items.length - 1 ? "border-b border-rule/70" : "",
            ].join(" ")}
          >
            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotClass[a.kind]}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-text leading-snug">{a.title}</div>
              <div className="mt-0.5 text-[11px] text-text-dim tabular">
                {a.when}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
