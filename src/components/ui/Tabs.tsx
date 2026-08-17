"use client";

// Small accessible tab bar. State persists via a URL query param so a
// refresh keeps the user on the same tab and deep links work. Mobile:
// horizontal-scroll strip; desktop: single row with hairline underline.
//
// No dependency on Radix / shadcn — 40 lines of app-scoped code is
// clearer than a wrapper around a full-fat lib.

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams, usePathname } from "next/navigation";
import { useMemo } from "react";

export interface TabDef {
  key:      string;
  label:    string;
  disabled?: boolean;
}

interface Props {
  tabs:  ReadonlyArray<TabDef>;
  param?: string;   // query-param name. defaults to "tab"
  className?: string;
}

export function Tabs({ tabs, param = "tab", className = "" }: Props) {
  const pathname = usePathname();
  const params   = useSearchParams();
  const active   = params.get(param) ?? tabs[0]?.key ?? "";

  const hrefFor = useMemo(() => (key: string): Route => {
    const next = new URLSearchParams(params);
    if (key === tabs[0]?.key) next.delete(param);   // clean URL for default tab
    else                       next.set(param, key);
    const qs = next.toString();
    return (qs ? `${pathname}?${qs}` : pathname) as Route;
  }, [params, pathname, param, tabs]);

  return (
    <div className={`border-b border-rule ${className}`} role="tablist" aria-label="Sections">
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={hrefFor(t.key)}
              role="tab"
              aria-selected={isActive}
              aria-disabled={t.disabled ? "true" : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={(e) => { if (t.disabled) e.preventDefault(); }}
              className={[
                "shrink-0 px-4 h-11 inline-flex items-center text-[13px] font-medium transition-colors border-b-2",
                isActive
                  ? "text-text border-gold"
                  : t.disabled
                    ? "text-text-faint cursor-not-allowed border-transparent"
                    : "text-text-dim hover:text-text border-transparent hover:border-rule",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
