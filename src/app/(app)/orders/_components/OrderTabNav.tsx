import Link from "next/link";
import type { Route } from "next";

interface OrderTabNavProps {
  active:        "orders" | "dispatch";
  orderCount:    number;
  dispatchCount: number;
}

export function OrderTabNav({ active, orderCount, dispatchCount }: OrderTabNavProps) {
  return (
    <div className="flex items-center gap-1 mb-4 p-1 rounded-[10px] bg-surface border border-rule w-fit">
      <TabLink
        href="/orders"
        label="Sales Orders"
        count={orderCount}
        active={active === "orders"}
      />
      <TabLink
        href="/orders?tab=dispatch"
        label="Dispatch"
        count={dispatchCount}
        active={active === "dispatch"}
      />
    </div>
  );
}

function TabLink({
  href, label, count, active,
}: { href: string; label: string; count: number; active: boolean }) {
  return (
    <Link
      href={href as Route}
      className={`h-[32px] px-4 rounded-[8px] text-[12.5px] font-medium transition-colors inline-flex items-center gap-2 ${
        active
          ? "bg-gold/15 text-gold"
          : "text-text-muted hover:text-text hover:bg-surface-hover"
      }`}
    >
      {label}
      <span
        className={`text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-[4px] ${
          active ? "bg-gold/20 text-gold" : "bg-rule text-text-subtle"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
