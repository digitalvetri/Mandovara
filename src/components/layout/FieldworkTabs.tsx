// The one place that says "site visits and measurements are the same
// module" (2026-08-27, owner instruction).
//
// They were two top-level nav entries — "Site Visit Management" and
// "Measurements" — describing two halves of a single act: someone drives
// to the site, and while they are there they measure. Staff had to know
// which of the two menu items to open, and nothing on either screen
// pointed at the other. Worse, `Measurement.siteVisitId` existed in the
// schema and no code had ever written it, so the two records were not
// even joined in the database.
//
// One nav entry now, and this strip switches between the two views of
// it. Both routes keep their URLs so existing links and bookmarks work.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { MapPin, Ruler } from "lucide-react";

const TABS = [
  { href: "/site-visits",  label: "Visits",       Icon: MapPin },
  { href: "/measurements", label: "Measurements", Icon: Ruler  },
] as const;

export function FieldworkTabs() {
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 pb-4"
      role="tablist"
      aria-label="Site visits and measurements"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href as Route}
            role="tab"
            aria-selected={active}
            className={
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium border transition-colors " +
              (active
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-surface-2 text-text-dim border-rule hover:text-text hover:border-text-dim")
            }
          >
            <Icon size={12} strokeWidth={1.9} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
