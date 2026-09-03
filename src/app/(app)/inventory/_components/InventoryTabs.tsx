import Link from "next/link";
import type { Route } from "next";
import { Boxes, ShoppingCart, AlertTriangle, PackageMinus } from "lucide-react";

type Key = "stock" | "purchasing" | "sold" | "pending";

interface Tab {
  key: Key;
  label: string;
  href: Route;
  Icon: typeof Boxes;
  badge?: number;
}

const TABS: readonly Tab[] = [
  { key: "stock",      label: "Stock",      href: "/inventory"         as Route, Icon: Boxes         },
  { key: "purchasing", label: "Purchasing", href: "/purchase"          as Route, Icon: ShoppingCart  },
  // Counter sales (owner, 2026-09-04). Sits next to Stock because it is
  // the other direction of the same shelf — what came in, what went out.
  { key: "sold",       label: "Sold out",   href: "/inventory/sold"    as Route, Icon: PackageMinus  },
  { key: "pending",    label: "Pending",    href: "/inventory/pending" as Route, Icon: AlertTriangle },
];

/**
 * @param pendingCount how many items are still unverified. Passed in by
 *   the caller rather than computed here.
 *
 *   This badge used to count rows in src/data/pending-stock.json — fine
 *   while that file WAS the list, but the queue moved to the database on
 *   2026-08-28. The badge would have read "25" forever while the page
 *   beside it showed items being ticked off, which is exactly the kind
 *   of quiet disagreement that makes people stop trusting a number.
 */
export function InventoryTabs({
  active, pendingCount,
}: { active: Key; pendingCount?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const isPending = t.key === "pending";
        const badge = t.key === "pending" ? pendingCount : t.badge;
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
            {badge != null && badge > 0 && (
              <span
                className={[
                  "ml-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums leading-none",
                  isActive ? "bg-white/20 text-ink" : "bg-heat/15 text-heat",
                ].join(" ")}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
