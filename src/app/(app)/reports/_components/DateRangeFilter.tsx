"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const PRESETS = [
  { label: "Today",    days: 0   },
  { label: "30 days",  days: 30  },
  { label: "90 days",  days: 90  },
  { label: "1 year",   days: 365 },
  { label: "All time", days: -1  },
] as const;

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export function DateRangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTr] = useTransition();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to,   setTo  ] = useState(params.get("to")   ?? "");

  function push(f: string, t: string) {
    const next = new URLSearchParams(params.toString());
    f ? next.set("from", f) : next.delete("from");
    t ? next.set("to",   t) : next.delete("to");
    const qs = next.toString();
    startTr(() => router.push(qs ? `/reports?${qs}` : "/reports"));
  }

  function preset(days: number) {
    if (days === -1) { setFrom(""); setTo(""); push("", ""); return; }
    const now = new Date();
    const f   = days === 0 ? ymd(now) : ymd(new Date(now.getTime() - days * 86_400_000));
    const t   = ymd(now);
    setFrom(f); setTo(t);
    push(f, t);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 bg-surface border border-rule rounded-[8px] px-3 h-[32px]">
        <span className="text-[11px] text-text-dim shrink-0">From</span>
        <input
          type="date" value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-transparent text-[12px] outline-none text-text w-[115px]"
        />
        <span className="text-text-dim text-[11px]">—</span>
        <span className="text-[11px] text-text-dim shrink-0">To</span>
        <input
          type="date" value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-transparent text-[12px] outline-none text-text w-[115px]"
        />
      </div>

      <button
        type="button" onClick={() => push(from, to)}
        className="h-[32px] px-3.5 rounded-[7px] text-[12px] font-medium bg-accent text-ink hover:bg-accent/90 transition-colors"
      >
        Apply
      </button>

      <div className="flex items-center gap-0.5 ml-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => preset(p.days)}
            className="h-[28px] px-2.5 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
