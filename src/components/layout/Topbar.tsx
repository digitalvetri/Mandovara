"use client";

import type { ReactNode } from "react";
import { Search, Plus } from "lucide-react";
import { ScheduleMenu } from "./ScheduleMenu";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";

interface TopbarProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** Show the calendar/schedule menu next to Search. Only the dashboard sets this. */
  showSchedule?: boolean;
}

// Responsive: on mobile the title/eyebrow stack above the actions row;
// search shrinks and the calendar button hides. On ≥ md, everything is
// on one row. The calendar renders only when explicitly enabled — it is
// primarily a dashboard affordance.

export function Topbar({ title, eyebrow, actions, showSchedule }: TopbarProps) {
  return (
    <header className="pt-5 pb-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-8">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] sm:text-[26px] lg:text-[30px] xl:text-[32px] leading-tight lg:leading-[1.05] font-semibold text-text break-words">
          {title}
        </h1>
        {eyebrow && (
          <div className="mt-1 text-[12px] text-text-dim">{eyebrow}</div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <SearchTrigger />
        <NotificationBell />
        <ThemeToggle />
        {showSchedule && <ScheduleMenu />}
        {actions}
      </div>
    </header>
  );
}

/** Fires the global "open command palette" event on click. The palette
 *  itself lives in the app layout (§6.3.1). This is a discoverability
 *  affordance for users who don't know the ⌘K shortcut. */
function SearchTrigger() {
  function open() {
    // Simulate a Ctrl+K press — the palette listens for this globally
    // and re-emitting the same shortcut keeps a single code path there.
    const evt = new KeyboardEvent("keydown", {
      key: "k", code: "KeyK", ctrlKey: true, bubbles: true,
    });
    window.dispatchEvent(evt);
  }
  return (
    <button
      type="button"
      onClick={open}
      title="Search — Ctrl K"
      aria-label="Open command palette"
      className="flex items-center gap-2 h-[38px] w-full sm:w-[200px] xl:w-[280px] px-3 bg-surface border border-rule rounded-[8px] text-left hover:bg-surface-hover transition-colors"
    >
      <Search size={14} strokeWidth={1.75} className="text-text-faint shrink-0" />
      <span className="flex-1 min-w-0 text-[12.5px] text-text-faint truncate">Search…</span>
      <kbd className="hidden sm:inline text-[10px] tabular text-text-faint border border-rule rounded-[4px] px-1.5 py-0.5">
        Ctrl K
      </kbd>
    </button>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px]
                 bg-accent text-white text-[12.5px] font-medium
                 hover:bg-accent-hover transition-colors whitespace-nowrap"
    >
      <Plus size={14} strokeWidth={2.25} />
      {children}
    </button>
  );
}
