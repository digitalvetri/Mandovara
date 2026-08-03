"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useTransition } from "react";

interface Props {
  counts: { open: number; today: number; overdue: number; completed: number };
}

const TABS = [
  { key: "OPEN",      label: "Open",      countKey: "open" as const },
  { key: "TODAY",     label: "Today",     countKey: "today" as const },
  { key: "OVERDUE",   label: "Overdue",   countKey: "overdue" as const },
  { key: "COMPLETED", label: "Completed", countKey: "completed" as const },
  { key: "ALL",       label: "All",       countKey: null },
];

export function FollowUpFilters({ counts }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const current = params.get("bucket") ?? "OPEN";
  const mineOnly = params.get("mine") === "1";

  function push(next: URLSearchParams) {
    startTransition(() => {
      const s = next.toString();
      router.push((s.length > 0 ? `/followups?${s}` : "/followups") as Route);
    });
  }
  function onBucket(k: string) {
    const next = new URLSearchParams(params.toString());
    if (k === "OPEN") next.delete("bucket"); else next.set("bucket", k);
    next.delete("page");
    push(next);
  }
  function onMine() {
    const next = new URLSearchParams(params.toString());
    if (mineOnly) next.delete("mine"); else next.set("mine", "1");
    push(next);
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex items-center gap-1 border border-rule rounded-[8px] bg-surface p-0.5">
        {TABS.map((t) => {
          const active = current === t.key;
          const count = t.countKey ? counts[t.countKey] : null;
          const bad = t.key === "OVERDUE" && count! > 0;
          return (
            <button key={t.key} type="button" onClick={() => onBucket(t.key)}
                    className={[
                      "h-[28px] px-3 rounded-[6px] text-[12px] transition-colors inline-flex items-center gap-1.5",
                      active ? "bg-accent text-white" : "text-text-dim hover:text-text hover:bg-surface-hover",
                    ].join(" ")}>
              <span>{t.label}</span>
              {count != null && (
                <span className={[
                  "tabular text-[10.5px] px-1.5 rounded-full",
                  active ? "bg-white/20 text-white"
                        : bad ? "bg-bad/12 text-bad"
                        : "bg-text-dim/12 text-text-dim",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={onMine}
              className={[
                "h-[28px] px-3 rounded-[6px] text-[12px] transition-colors border",
                mineOnly ? "bg-accent text-white border-accent" : "bg-surface text-text-dim border-rule hover:text-text",
              ].join(" ")}>
        Mine only
      </button>
    </div>
  );
}
