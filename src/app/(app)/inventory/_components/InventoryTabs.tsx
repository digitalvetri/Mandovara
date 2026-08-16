import Link from "next/link";
import type { Route } from "next";
import { Boxes, ShoppingCart } from "lucide-react";

type Key = "stock" | "purchasing";

interface Tab {
  key: Key;
  label: string;
  href: Route;
  Icon: typeof Boxes;
}

const TABS: readonly Tab[] = [
  { key: "stock",      label: "Stock",      href: "/inventory" as Route, Icon: Boxes        },
  { key: "purchasing", label: "Purchasing", href: "/purchase"  as Route, Icon: ShoppingCart },
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
