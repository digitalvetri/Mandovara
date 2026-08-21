import Link from "next/link";
import type { Route } from "next";
import { Boxes, ShoppingCart, AlertTriangle } from "lucide-react";
import pendingData from "@/data/pending-stock.json";

type Key = "stock" | "purchasing" | "pending";

interface Tab {
  key: Key;
  label: string;
  href: Route;
  Icon: typeof Boxes;
  badge?: number;
}

const pendingCount = (pendingData.sections as { items: unknown[] }[]).reduce(
  (s, sec) => s + sec.items.length,
  0
);

const TABS: readonly Tab[] = [
  { key: "stock",      label: "Stock",      href: "/inventory"         as Route, Icon: Boxes         },
  { key: "purchasing", label: "Purchasing", href: "/purchase"           as Route, Icon: ShoppingCart  },
  { key: "pending",    label: "Pending",    href: "/inventory/pending" as Route, Icon: AlertTriangle, badge: pendingCount },
];

export function InventoryTabs({ active }: { active: Key }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const isPending = t.key === "pending";
        return (
          <Link
            key={t.key}
            href={t.href}
            className={[
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-medium transition-colors",
              isActive && isPending
                ? "bg-heat text-ink"
                : isActive
                ? "bg-solid text-ink"
                : "border border-rule bg-surface text-text-dim hover:text-text",
            ].join(" ")}
          >
            <t.Icon size={13} strokeWidth={2} />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className={[
                  "ml-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums leading-none",
                  isActive ? "bg-white/20 text-ink" : "bg-heat/15 text-heat",
                ].join(" ")}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
