import type { OrderStatus } from "@/modules/orders/schema";
import type { OrderStatusCounts } from "@/modules/orders/queries";

interface CardDef {
  key: OrderStatus | "open";
  label: string;
  borderColor: string;
  numColor:    string;
}

const CARDS: CardDef[] = [
  { key: "CONFIRMED",        label: "Confirmed",    borderColor: "border-l-heat",  numColor: "text-heat"  },
  { key: "PROCUREMENT",      label: "Procurement",  borderColor: "border-l-heat",  numColor: "text-heat"  },
  { key: "MAKE",             label: "Make",         borderColor: "border-l-info",  numColor: "text-info"  },
  { key: "COMPLETED",        label: "Completed",    borderColor: "border-l-solid", numColor: "text-solid" },
  { key: "CANCELLED",        label: "Cancelled",    borderColor: "border-l-fault", numColor: "text-fault" },
  { key: "open",             label: "Total Open",   borderColor: "border-l-accent",numColor: "text-accent"},
];

export function OrderSummaryCards({ counts }: { counts: OrderStatusCounts }) {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
      {CARDS.map((c) => {
        const count = c.key === "open" ? counts.open : (counts.byStatus[c.key as OrderStatus] ?? 0);
        return (
          <div
            key={c.key}
            className={`rounded-[10px] bg-surface border border-rule border-l-[3px] ${c.borderColor} px-3 py-2.5`}
          >
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-text-muted leading-none mb-1.5">
              {c.label}
            </div>
            <div className={`font-data text-[22px] tabular-nums leading-none font-semibold ${c.numColor}`}>
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}
