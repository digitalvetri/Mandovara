"use client";

import { useEffect, useState } from "react";
import { Sunrise, Sun, Sunset, Moon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  userName: string;
}

interface GreetInfo {
  label: string;
  Icon: LucideIcon;
}

// IST = UTC + 5:30; compute with UTC methods to avoid locale surprises.
function toISTDate(d: Date) {
  const ist = new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000);
  const h24 = ist.getUTCHours();
  const m   = ist.getUTCMinutes();
  const s   = ist.getUTCSeconds();
  const h12 = h24 % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hhmm:   `${pad(h12)}:${pad(m)}`,
    ss:     pad(s),
    ampm:   h24 < 12 ? "AM" : "PM",
    hour24: h24,
    dateStr: d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }),
  };
}

function greet(h: number): GreetInfo {
  if (h < 6)  return { label: "Good night",     Icon: Moon    };
  if (h < 12) return { label: "Good morning",   Icon: Sunrise };
  if (h < 17) return { label: "Good afternoon", Icon: Sun     };
  if (h < 20) return { label: "Good evening",   Icon: Sunset  };
  return         { label: "Good evening",     Icon: Moon    };
}

export function GreetingHero({ userName }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const firstName = userName.split(" ")[0] || "there";
  const parts     = now ? toISTDate(now) : null;
  const { label: greetLabel, Icon: GreetIcon } = greet(parts?.hour24 ?? 10);

  return (
    <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text">
      <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-facets" />

      <div className="relative z-10 px-6 py-5 sm:px-8 sm:py-6">
        {/* Live date chip */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3.5 py-1.5 text-[11px] font-medium text-sidebar-dim tracking-[0.04em]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-chrome" />
          {parts ? parts.dateStr : "          "}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          {/* Left — greeting + name */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12.5px] text-sidebar-dim">
              <GreetIcon size={13} strokeWidth={1.8} aria-hidden />
              <span>{greetLabel}</span>
            </div>

            <h2 className="mt-1.5 font-display text-[28px] sm:text-[34px] font-[560] leading-none tracking-[-0.015em] text-sidebar-text">
              {firstName}
              <span className="text-accent-chrome">.</span>
            </h2>

            <p className="mt-2 text-[12.5px] text-sidebar-dim leading-snug">
              Here&rsquo;s what&rsquo;s on today at Mandovara.
            </p>
          </div>

          {/* Right — live clock */}
          <div className="shrink-0 text-right">
            <div className="font-data leading-none tabular-nums text-sidebar-text">
              <span className="text-[32px] sm:text-[38px] font-medium tracking-[-0.02em]">
                {parts ? parts.hhmm : "--:--"}
              </span>
              <span className="text-[20px] sm:text-[24px] text-sidebar-dim/70">
                :{parts ? parts.ss : "--"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="rounded-sm bg-accent-chrome/20 px-1.5 py-[3px] text-[10px] font-semibold text-accent-chrome tracking-[0.06em]">
                {parts ? parts.ampm : "AM"}
              </span>
              <span className="text-[10.5px] text-sidebar-dim/70 tracking-[0.14em]">IST</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
