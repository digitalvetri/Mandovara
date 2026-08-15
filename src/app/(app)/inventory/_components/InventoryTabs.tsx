// Four-tab pill row across the top of the inventory module.
// Only "Stock" is fully wired today; the other three link at existing
// modules so nothing dead-ends in a placeholder.

import Link from "next/link";
import type { Route } from "next";
import { Boxes, ShoppingCart, ArrowRightLeft, ClipboardList } from "lucide-react";

type Key = "stock" | "purchasing" | "operations" | "requests";

interface Tab {
  key: Key;
  label: string;
  href: Route;
  Icon: typeof Boxes;
}

const TABS: readonly Tab[] = [
  { key: "stock",       label: "Stock",       href: "/inventory" as Route,          Icon: Boxes           },
  { key: "purchasing",  label: "Purchasing",  href: "/purchase"  as Route,          Icon: ShoppingCart    },
  { key: "operations",  label: "Operations",  href: "/inventory?tab=operations" as Route, Icon: ArrowRightLeft },
  { key: "requests",    label: "Requests",    href: "/inventory?tab=requests"   as Route, Icon: ClipboardList  },
];

export function InventoryTabs({ active }: { active: Key }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={[
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-medium transition-colors",
              isActive
                ? "bg-solid text-ink"
                : "border border-rule bg-surface text-text-dim hover:text-text",
            ].join(" ")}
          >
            <t.Icon size={13} strokeWidth={2} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
